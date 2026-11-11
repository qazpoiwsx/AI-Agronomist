import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Battery, 
  BatteryCharging, 
  Navigation as NavigationIcon, 
  Wind, 
  Cpu, 
  Waypoints,
  Activity,
  Shield,
  Plus,
  Play,
  Square,
  RefreshCcw,
  Radar,
  Signal,
  Compass,
  Wifi,
  Bluetooth,
  X,
  Loader2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Language, translations } from '../translations';
import { Drone } from '../types';
import { MapContainer, TileLayer, Polyline, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';

interface DroneMonitoringProps {
  lang: Language;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function DroneMonitoring({ lang }: DroneMonitoringProps) {
  const t = translations[lang].drones;
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDroneId, setActiveDroneId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDrones, setDiscoveredDrones] = useState<{name: string, signal: number, type: 'wifi' | 'bt'}[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newDroneName, setNewDroneName] = useState('');
  const [connectionType, setConnectionType] = useState<'scan' | 'manual'>('scan');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoDrone, setDemoDrone] = useState({
    id: 'demo-drone',
    name: 'AgroDron-1',
    status: 'idle' as any,
    altitude: 0,
    speed: 0,
    battery: 100,
    lat: 51.1605,
    lng: 71.4704,
    homeLat: 51.1605,
    homeLng: 71.4704,
    bearing: 0,
    path: [[51.1605, 71.4704]] as [number, number][],
    waypoints: [] as [number, number][],
    targetWaypointIndex: 0,
    targetIndex: 0,
    connectivity: 100,
    gpsAccuracy: 1.2,
    scannedArea: 0,
    ownerId: 'demo'
  });

  const demoPath: [number, number][] = [
    [51.1605, 71.4704],
    [51.1685, 71.4704],
    [51.1685, 71.4850],
    [51.1605, 71.4850]
  ];

  // Demo Simulation Logic
  useEffect(() => {
    let interval: any;
    if (isDemoMode && ['active', 'returning', 'landing'].includes(demoDrone.status)) {
      interval = setInterval(() => {
        setDemoDrone(prev => {
          if (prev.battery <= 0) return { ...prev, status: 'idle', speed: 0, altitude: 0 };
          
          if (prev.status === 'landing') {
             return {
               ...prev,
               altitude: 0,
               speed: 0,
               status: 'idle' as any,
               battery: Math.max(0, prev.battery - 0.01),
               path: [...prev.path, [prev.lat, prev.lng]].slice(-200) as [number, number][]
             };
          }

          let newLat = prev.lat;
          let newLng = prev.lng;
          let nextTargetIndex = prev.targetIndex;
          let newBearing = prev.bearing;
          let newStatus = prev.status;
          let newSpeed = prev.speed;
          let newAltitude = prev.altitude;

          const waypointsToFollow = prev.waypoints.length > 0 ? prev.waypoints : demoPath;
          
          if (prev.status === 'returning') {
            const latDiff = prev.homeLat - prev.lat;
            const lngDiff = prev.homeLng - prev.lng;
            const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

            if (distance < 0.0002) {
              newStatus = 'idle';
              newSpeed = 0;
              newAltitude = 0;
            } else {
              const step = 0.0006; // RTH speed
              newLat += (latDiff / distance) * step;
              newLng += (lngDiff / distance) * step;
              newBearing = (Math.atan2(lngDiff, latDiff) * 180 / Math.PI + 360) % 360;
            }
          } else {
            const target = waypointsToFollow[prev.targetIndex];
            const latDiff = target[0] - prev.lat;
            const lngDiff = target[1] - prev.lng;
            const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
            
            if (distance < 0.0005) {
              nextTargetIndex = (prev.targetIndex + 1) % waypointsToFollow.length;
            } else {
              // Move towards target
              const step = 0.0003;
              newLat += (latDiff / distance) * step;
              newLng += (lngDiff / distance) * step;
              newBearing = (Math.atan2(lngDiff, latDiff) * 180 / Math.PI + 360) % 360;
            }
            newSpeed = parseFloat((Math.random() * (25 - 15) + 15).toFixed(1));
            newAltitude = parseFloat((Math.random() * (60 - 40) + 40).toFixed(1));
          }

          const newPath = [...prev.path, [newLat, newLng]] as [number, number][];
          
          return {
            ...prev,
            lat: newLat,
            lng: newLng,
            bearing: newBearing,
            battery: Math.max(0, prev.battery - 0.25),
            altitude: newAltitude,
            speed: newSpeed,
            status: newStatus as any,
            path: newPath.slice(-200),
            targetIndex: nextTargetIndex,
            scannedArea: prev.scannedArea + (newStatus === 'active' ? 0.002 : 0),
            connectivity: Math.max(85, 100 - Math.random() * 5)
          };
        });
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isDemoMode, demoDrone.status]);

  const toggleDemoMission = () => {
    if (demoDrone.status === 'idle') {
      setDemoDrone(prev => ({ 
        ...prev, 
        status: 'active', 
        altitude: 30, 
        speed: 15,
        targetIndex: 0
      }));
    } else {
      setDemoDrone(prev => ({ 
        ...prev, 
        status: 'idle', 
        altitude: 0, 
        speed: 0 
      }));
    }
  };

  // Firestore Real-time listener
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'drones'),
        where('ownerId', '==', user.uid)
      );

      const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const droneData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Drone[];
        
        // Manual sort to avoid needing a composite index
        droneData.sort((a, b) => a.name.localeCompare(b.name));
        
        setDrones(droneData);
        setLoading(false);
        
        if (droneData.length > 0 && !activeDroneId) {
          setActiveDroneId(droneData[0].id);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'drones');
        setLoading(false);
      });

      return () => unsubscribeSnapshot();
    });

    return () => unsubscribeAuth();
  }, [activeDroneId]);

  const startScan = () => {
    setIsScanning(true);
    setDiscoveredDrones([]);
    setTimeout(() => {
      setDiscoveredDrones([
        { name: "DJI-AGRAS-T40-9283", signal: 92, type: 'wifi' },
        { name: "SKYWALKER-PRO-X", signal: 76, type: 'bt' },
        { name: "PELICAN-CROP-v2", signal: 88, type: 'bt' }
      ]);
      setIsScanning(false);
    }, 2500);
  };

  // Simulated Scanning Effect
  useEffect(() => {
    if (isAddModalOpen && connectionType === 'scan') {
      startScan();
    }
  }, [isAddModalOpen, connectionType]);

  const handleConnectDiscovered = async (name: string) => {
    if (!auth.currentUser) return;
    setIsAdding(true);
    const startLat = 51.1605 + (Math.random() - 0.5) * 0.01;
    const startLng = 71.4704 + (Math.random() - 0.5) * 0.01;
    try {
      await addDoc(collection(db, 'drones'), {
        name,
        ownerId: auth.currentUser.uid,
        lat: startLat,
        lng: startLng,
        homeLat: startLat,
        homeLng: startLng,
        status: 'idle',
        battery: 100,
        altitude: 0,
        speed: 0,
        connectivity: 100,
        scannedArea: 0,
        bearing: 0,
        gpsAccuracy: 0.8,
        path: [[startLat, startLng]],
        waypoints: [],
        targetWaypointIndex: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsAddModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'drones');
    } finally {
      setIsAdding(false);
    }
  };

  const seedDemoDrones = () => {
    setIsDemoMode(true);
  };

  const handleAddDrone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDroneName.trim() || !auth.currentUser) return;

    setIsAdding(true);
    const defaultLat = 51.1605;
    const defaultLng = 71.4704;
    try {
      await addDoc(collection(db, 'drones'), {
        name: newDroneName,
        ownerId: auth.currentUser.uid,
        status: 'idle',
        battery: 100,
        altitude: 0,
        speed: 0,
        connectivity: 100,
        scannedArea: 0,
        lat: defaultLat, 
        lng: defaultLng,
        homeLat: defaultLat,
        homeLng: defaultLng,
        bearing: 0,
        gpsAccuracy: 2.0,
        path: [[defaultLat, defaultLng]],
        waypoints: [],
        targetWaypointIndex: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewDroneName('');
      setIsAddModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'drones');
    } finally {
      setIsAdding(false);
    }
  };

  const toggleMission = async (drone: Drone) => {
    const isTakingOff = drone.status === 'idle' || drone.status === 'offline';
    const newStatus = isTakingOff ? 'active' : 'idle';
    
    if (drone.id === 'demo-drone') {
      setDemoDrone(prev => ({
        ...prev,
        status: newStatus as any,
        altitude: isTakingOff ? 30 : 0,
        speed: isTakingOff ? 25 : 0
      }));
      return;
    }

    try {
      await updateDoc(doc(db, 'drones', drone.id), {
        status: newStatus,
        altitude: isTakingOff ? 30 : 0,
        speed: isTakingOff ? 25 : 0,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drones/${drone.id}`);
    }
  };

  const handleRTH = async (drone: Drone) => {
    if (drone.status === 'idle' || drone.status === 'offline') return;
    
    if (drone.id === 'demo-drone') {
      setDemoDrone(prev => ({
        ...prev,
        status: 'returning' as any,
        speed: 30
      }));
      return;
    }

    try {
      await updateDoc(doc(db, 'drones', drone.id), {
        status: 'returning',
        speed: 30, // Optimized speed for RTH
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drones/${drone.id}`);
    }
  };

  const handleEmergencyLanding = async (drone: Drone) => {
    if (drone.status === 'idle' || drone.status === 'offline') return;

    if (drone.id === 'demo-drone') {
      setDemoDrone(prev => ({
        ...prev,
        status: 'landing' as any,
        speed: 0,
        altitude: 0
      }));
      setTimeout(() => {
        setDemoDrone(prev => ({ ...prev, status: 'idle' }));
      }, 1000);
      return;
    }

    try {
      await updateDoc(doc(db, 'drones', drone.id), {
        status: 'landing',
        speed: 0,
        altitude: 0,
        updatedAt: serverTimestamp()
      });
      
      // Auto-switch to idle after 1 second as requested
      setTimeout(async () => {
        try {
          await updateDoc(doc(db, 'drones', drone.id), {
            status: 'idle',
            updatedAt: serverTimestamp()
          });
        } catch (e) {
          // Ignore if already deleted or disconnected
        }
      }, 1000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drones/${drone.id}`);
    }
  };

  const deleteDrone = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот дрон?')) return;
    try {
      await deleteDoc(doc(db, 'drones', id));
      if (activeDroneId === id) setActiveDroneId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `drones/${id}`);
    }
  };

  // Ref to track latest drones for simulation without re-triggering effect
  const dronesRef = React.useRef<Drone[]>([]);
  useEffect(() => {
    dronesRef.current = drones;
  }, [drones]);

  // Simulation effect for active drones
  useEffect(() => {
    const interval = setInterval(() => {
      const activeDrones = dronesRef.current.filter(d => ['active', 'returning', 'landing'].includes(d.status));
      if (activeDrones.length === 0) return;

      activeDrones.forEach(d => {
        const droneDocRef = doc(db, 'drones', d.id);
        
        if (d.status === 'landing') {
          updateDoc(droneDocRef, {
            altitude: 0,
            speed: 0,
            status: 'idle',
            battery: Math.max(0, d.battery - 0.01),
            updatedAt: serverTimestamp()
          }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `drones/${d.id}`));
          return;
        }

        let newLat = d.lat;
        let newLng = d.lng;
        let newBearing = d.bearing;
        let newStatus = d.status;
        let newSpeed = d.speed;
        let newAltitude = d.altitude;
        let targetIndex = d.targetWaypointIndex || 0;

        if (d.status === 'returning') {
          const latDiff = d.homeLat - d.lat;
          const lngDiff = d.homeLng - d.lng;
          const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

          if (distance < 0.0002) {
            newStatus = 'idle';
            newSpeed = 0;
            newAltitude = 0;
          } else {
            const step = 0.0006;
            newLat += (latDiff / distance) * step;
            newLng += (lngDiff / distance) * step;
            newBearing = (Math.atan2(lngDiff, latDiff) * 180 / Math.PI + 360) % 360;
          }
        } else if (d.waypoints && d.waypoints.length > 0) {
          // Follow waypoints
          const target = d.waypoints[targetIndex];
          const latDiff = target[0] - d.lat;
          const lngDiff = target[1] - d.lng;
          const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

          if (distance < 0.0005) {
            targetIndex = (targetIndex + 1) % d.waypoints.length;
            newSpeed = 10; // Slow down at waypoint
          } else {
            const step = 0.0004; // Waypoint following speed
            newLat += (latDiff / distance) * step;
            newLng += (lngDiff / distance) * step;
            newBearing = (Math.atan2(lngDiff, latDiff) * 180 / Math.PI + 360) % 360;
            newSpeed = 25;
          }
          newAltitude = Math.max(20, Math.min(50, (d.altitude || 30) + (Math.random() - 0.5)));
        } else {
          // Normal active flight simulation (random walk if no waypoints)
          const speedMs = (d.speed / 3.6) || 5; 
          const dist = speedMs * 2; 
          const R = 6371e3;
          const bearingRad = (d.bearing * Math.PI) / 180;
          const φ1 = (d.lat * Math.PI) / 180;
          const λ1 = (d.lng * Math.PI) / 180;

          const φ2 = Math.asin(Math.sin(φ1) * Math.cos(dist/R) + Math.cos(φ1) * Math.sin(dist/R) * Math.cos(bearingRad));
          const λ2 = λ1 + Math.atan2(Math.sin(bearingRad) * Math.sin(dist/R) * Math.cos(φ1), Math.cos(dist/R) - Math.sin(φ1) * Math.sin(φ2));

          newLat = (φ2 * 180) / Math.PI;
          newLng = (λ2 * 180) / Math.PI;
          newBearing = (d.bearing + (Math.random() - 0.5) * 15) % 360;
          newSpeed = Math.max(15, Math.min(45, (d.speed || 20) + (Math.random() - 0.5) * 5));
          newAltitude = Math.max(15, Math.min(60, (d.altitude || 30) + (Math.random() - 0.5) * 1.5));
        }

        updateDoc(droneDocRef, {
          lat: newLat,
          lng: newLng,
          bearing: newBearing >= 0 ? newBearing : 360 + newBearing,
          battery: Math.max(0, d.battery - 0.05),
          scannedArea: (d.scannedArea || 0) + (newStatus === 'active' ? 0.005 : 0),
          speed: newSpeed,
          altitude: newAltitude,
          status: newStatus,
          targetWaypointIndex: targetIndex,
          path: [...(d.path || []).slice(-100), [newLat, newLng]],
          updatedAt: serverTimestamp()
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `drones/${d.id}`));
      });
    }, 2000); 

    return () => clearInterval(interval);
  }, []);

  const activeDrone = drones.find(d => d.id === activeDroneId) || (isDemoMode ? demoDrone : drones[0]);

  const handleMapClick = async (lat: number, lng: number) => {
    if (!activeDrone) return;

    if (activeDrone.id === 'demo-drone') {
      setDemoDrone(prev => ({
        ...prev,
        waypoints: [...(prev.waypoints || []), [lat, lng]]
      }));
      return;
    }

    try {
      await updateDoc(doc(db, 'drones', activeDrone.id), {
        waypoints: [...(activeDrone.waypoints || []), [lat, lng]],
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drones/${activeDrone.id}`);
    }
  };

  const clearWaypoints = async (drone: Drone) => {
    if (drone.id === 'demo-drone') {
      setDemoDrone(prev => ({
        ...prev,
        waypoints: [],
        targetIndex: 0
      }));
      return;
    }

    try {
      await updateDoc(doc(db, 'drones', drone.id), {
        waypoints: [],
        targetWaypointIndex: 0,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drones/${drone.id}`);
    }
  };

  const getStatusColor = (status: Drone['status']) => {
    switch (status) {
      case 'active': return 'text-emerald-500 bg-emerald-50';
      case 'returning': return 'text-amber-500 bg-amber-50';
      case 'landing': return 'text-orange-500 bg-orange-50';
      case 'idle': return 'text-blue-500 bg-blue-50';
      case 'charging': return 'text-amber-500 bg-amber-50';
      default: return 'text-slate-400 bg-slate-50';
    }
  };

  const getBatteryIcon = (level: number, status: string) => {
    if (status === 'charging') return <BatteryCharging className="w-5 h-5 text-amber-500 animate-pulse" />;
    if (level > 80) return <Battery className="w-5 h-5 text-emerald-500" />;
    if (level > 20) return <Battery className="w-5 h-5 text-amber-500" />;
    return <Battery className="w-5 h-5 text-red-500 animate-bounce" />;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
        <p className="text-slate-500">Загрузка данных телеметрии...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t.title}</h2>
          <p className="text-slate-500 text-sm">Управление парком БПЛА для мониторинга</p>
        </div>
        <button 
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm active:scale-95"
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Подключить дрон</span>
        </button>
      </div>

      {drones.length === 0 && !isDemoMode ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
            <Radar className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">{t.noDrones}</h3>
          <p className="text-slate-500 mb-8 max-w-sm mx-auto">Подключите ваш первый дрон для начала мониторинга полей и анализа состояния культур.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
               onClick={() => setIsAddModalOpen(true)}
               className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 w-full sm:w-auto"
            >
              Добавить устройство
            </button>
            <button 
               onClick={seedDemoDrones}
               className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 flex items-center justify-center gap-3 w-full sm:w-auto"
            >
              <Play className="w-6 h-6 fill-current" />
              Запустить мониторинг
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isDemoMode && (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "bg-white rounded-2xl border p-5 shadow-md transition-all group relative overflow-hidden",
                !activeDroneId ? "border-emerald-500 ring-4 ring-emerald-500/5" : "border-slate-100"
              )}
              onClick={() => setActiveDroneId(null)}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <Radar className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{demoDrone.name}</h3>
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1",
                      demoDrone.status === 'active' ? 'text-emerald-500 bg-emerald-50' : 
                      demoDrone.status === 'returning' ? 'text-amber-500 bg-amber-50' :
                      demoDrone.status === 'landing' ? 'text-orange-500 bg-orange-50' : 
                      'text-blue-500 bg-blue-50'
                    )}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {demoDrone.status === 'active' ? t.active : 
                       demoDrone.status === 'returning' ? t.returning :
                       demoDrone.status === 'landing' ? t.emergencyLanding :
                       t.idle}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">{Math.round(demoDrone.battery)}%</span>
                  {getBatteryIcon(demoDrone.battery, demoDrone.status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-50 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[9px] uppercase font-bold mb-1">
                    <NavigationIcon className="w-2.5 h-2.5" />
                    Координаты
                  </div>
                  <div className="text-[10px] font-bold text-slate-800 font-mono truncate">
                    {demoDrone.lat.toFixed(4)}, {demoDrone.lng.toFixed(4)}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[9px] uppercase font-bold mb-1">
                    <Waypoints className="w-2.5 h-2.5" />
                    Высота
                  </div>
                  <div className="text-xs font-bold text-slate-800 font-mono">{demoDrone.altitude}м</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleDemoMission(); }}
                  className={cn(
                    "flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all active:scale-95",
                    demoDrone.status === 'idle' ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
                  )}
                >
                  {demoDrone.status === 'idle' ? <Play className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {demoDrone.status === 'idle' ? "Взлёт" : "Посадка"}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsDemoMode(false); }}
                  className="px-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-colors"
                  title="Выйти"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
          {drones.map((drone) => (
            <motion.div 
              key={drone.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setActiveDroneId(drone.id)}
              className={cn(
                "bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden",
                activeDroneId === drone.id ? "border-emerald-500 ring-4 ring-emerald-500/5" : "border-slate-100"
              )}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                    <Radar className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 truncate max-w-[120px]">{drone.name}</h3>
                    <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1", getStatusColor(drone.status))}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {drone.status === 'active' ? t.active : 
                       drone.status === 'returning' ? t.returning :
                       drone.status === 'landing' ? t.emergencyLanding :
                       drone.status === 'idle' ? t.idle : t.charging}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">{Math.round(drone.battery)}%</span>
                  {getBatteryIcon(drone.battery, drone.status)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-slate-50 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[9px] uppercase font-bold mb-1">
                    <NavigationIcon className="w-2.5 h-2.5" />
                    Высота
                  </div>
                  <div className="text-xs font-bold text-slate-800 font-mono">{(drone.altitude || 0).toFixed(1)}м</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[9px] uppercase font-bold mb-1">
                    <Wind className="w-2.5 h-2.5" />
                    Скорость
                  </div>
                  <div className="text-xs font-bold text-slate-800 font-mono">{(drone.speed || 0).toFixed(1)}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[9px] uppercase font-bold mb-1">
                    <Waypoints className="w-2.5 h-2.5" />
                    S (га)
                  </div>
                  <div className="text-xs font-bold text-slate-800 font-mono">{(drone.scannedArea || 0).toFixed(1)}</div>
                </div>
              </div>

              <div className="flex gap-2 relative z-10">
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleMission(drone); }}
                  className={cn(
                    "flex-1 py-2 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all active:scale-95",
                    drone.status === 'idle' ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  {drone.status === 'idle' ? <Play className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                  {drone.status === 'idle' ? "Взлёт" : "Посадка"}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteDrone(drone.id); }}
                  className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {activeDrone && (
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeDrone.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-2 space-y-6">
              {/* Telemetry Display */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                 <div className="flex items-center justify-between mb-6">
                   <h3 className="font-bold text-slate-800 flex items-center gap-2">
                     <Activity className="w-5 h-5 text-emerald-500" />
                     Телеметрия: <span className="text-emerald-600 font-mono">{activeDrone.name}</span>
                   </h3>
                   <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2">
                       <Signal className={cn("w-4 h-4", activeDrone.connectivity > 70 ? "text-emerald-500" : "text-amber-500")} />
                       <span className="text-xs font-bold text-slate-600 font-mono">{activeDrone.connectivity}%</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <Shield className="w-4 h-4 text-blue-500" />
                       <span className="text-xs font-bold text-slate-600 font-mono">RTK: {activeDrone.gpsAccuracy}cm</span>
                     </div>
                   </div>
                 </div>

                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Широта</p>
                     <p className="font-mono text-sm font-bold text-slate-800">{(activeDrone.lat || 0).toFixed(6)}°</p>
                   </div>
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Долгота</p>
                     <p className="font-mono text-sm font-bold text-slate-800">{(activeDrone.lng || 0).toFixed(6)}°</p>
                   </div>
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Курс</p>
                     <div className="flex items-center gap-2">
                       <Compass className="w-4 h-4 text-emerald-500 transition-transform duration-500" style={{ transform: `rotate(${activeDrone.bearing || 0}deg)` }} />
                       <p className="font-mono text-sm font-bold text-slate-800">{Math.round(activeDrone.bearing || 0)}°</p>
                     </div>
                   </div>
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Область</p>
                     <p className="font-mono text-sm font-bold text-emerald-600">{(activeDrone.scannedArea || 0).toFixed(3)} га</p>
                   </div>
                 </div>
              </div>

              {/* MiniMap Visualization */}
              <div className="bg-slate-900 rounded-3xl h-[450px] relative overflow-hidden shadow-2xl border-4 border-slate-800 group">
                <MapContainer 
                  center={[activeDrone.lat, activeDrone.lng]} 
                  zoom={18} 
                  className="h-full w-full"
                  zoomControl={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <RecenterMap center={[activeDrone.lat, activeDrone.lng]} />
                  <MapEvents onMapClick={handleMapClick} />
                  <Polyline positions={activeDrone.path || []} color="#10b981" weight={4} opacity={0.6} />
                  {activeDrone.waypoints && activeDrone.waypoints.length > 0 && (
                    <>
                      <Polyline positions={activeDrone.waypoints} color="#6366f1" weight={3} dashArray="10, 10" opacity={0.5} />
                      {activeDrone.waypoints.map((wp, idx) => (
                        <Marker 
                          key={`wp-${idx}`}
                          position={wp}
                          icon={L.divIcon({
                            html: `<div class="w-6 h-6 bg-indigo-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white">${idx + 1}</div>`,
                            className: 'waypoint-icon',
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                          })}
                        />
                      ))}
                    </>
                  )}
                  <Marker 
                    position={[activeDrone.lat, activeDrone.lng]}
                    icon={L.divIcon({
                      html: `<div style="transform: rotate(${activeDrone.bearing}deg); transition: transform 0.5s ease-out;">
                        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
                        </svg>
                      </div>`,
                      className: 'drone-marker-icon',
                      iconSize: [40, 40],
                      iconAnchor: [20, 20]
                    })}
                  />
                  <Circle 
                    center={[activeDrone.lat, activeDrone.lng]}
                    radius={activeDrone.gpsAccuracy / 100}
                    pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2 }}
                  />
                </MapContainer>
                
                <div className="absolute top-4 right-4 z-[1000] space-y-2">
                   <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 p-3 rounded-2xl text-white shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 flex items-center justify-center">
                          <Compass className="w-5 h-5 text-emerald-400" style={{ transform: `rotate(${activeDrone.bearing}deg)` }} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Heading</p>
                          <p className="font-mono text-sm font-bold">{Math.round(activeDrone.bearing)}°</p>
                        </div>
                      </div>
                   </div>
                </div>

                <div className="absolute bottom-6 left-6 z-[1000] bg-slate-900/80 backdrop-blur-md border border-white/10 p-4 rounded-2xl text-white shadow-lg max-w-[200px]">
                   <div className="space-y-3">
                     <div className="flex items-center gap-3">
                       <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                         <Signal className="w-4 h-4 text-emerald-400" />
                       </div>
                       <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Link QoS: {activeDrone.connectivity}%</span>
                     </div>
                     <div className="flex items-center gap-3">
                       <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                         <Activity className="w-4 h-4 text-blue-400" />
                       </div>
                       <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">RTK status: FIXED</span>
                     </div>
                   </div>
                </div>
              </div>
            </div>

            {/* Sidebar Controls */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm h-full flex flex-col">
                <div className="flex-1">
                  <h4 className="font-bold text-slate-500 mb-6 flex items-center gap-2 uppercase text-[10px] tracking-[0.2em]">
                    <Plus className="w-4 h-4 text-emerald-500" />
                    Параметры задания
                  </h4>
                  <div className="space-y-8">
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                           <Waypoints className="w-5 h-5" />
                         </div>
                         <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Точки маршрута</p>
                            <p className="text-sm font-bold text-slate-800">{(activeDrone.waypoints || []).length} задано</p>
                         </div>
                       </div>
                       {(activeDrone.waypoints || []).length > 0 && (
                         <button 
                           onClick={() => clearWaypoints(activeDrone)}
                           className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                           title="Очистить маршрут"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       )}
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-slate-600">Охват территории</span>
                        <span className="text-sm font-bold text-emerald-600">{(activeDrone.scannedArea / 10 * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-emerald-500" 
                          initial={{ width: 0 }}
                          animate={{ width: `${(activeDrone.scannedArea / 10 * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 bg-slate-50 rounded-2xl text-center">
                          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Спутники</p>
                          <p className="text-lg font-bold text-slate-800">18</p>
                       </div>
                       <div className="p-4 bg-slate-50 rounded-2xl text-center">
                          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Заряд БПЛА</p>
                          <p className="text-lg font-bold text-emerald-600">{Math.round(activeDrone.battery)}%</p>
                       </div>
                    </div>

                    <ul className="space-y-5 pt-8 border-t border-slate-50">
                      <li className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Условия полета</span>
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-emerald-100">
                          <Wind className="w-3 h-3" />
                          Оптимально
                        </span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Помехи связи</span>
                        <span className="text-xs font-bold text-slate-800">Низкие / 0.2%</span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Система обхода</span>
                        <div className="flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                           <span className="text-xs font-bold text-emerald-600">Активна</span>
                        </div>
                      </li>
                      <li className="pt-4 border-t border-slate-50">
                        <p className="text-[10px] text-slate-400 leading-relaxed italic">
                          💡 Кликните по карте, чтобы добавить путевые точки. Дрон будет следовать по ним в режиме миссии.
                        </p>
                      </li>
                    </ul>
                  </div>
                </div>
                
                <div className="mt-12 space-y-3">
                  <button 
                    onClick={() => handleRTH(activeDrone)}
                    disabled={activeDrone.status === 'idle' || activeDrone.status === 'offline' || activeDrone.status === 'returning' || activeDrone.status === 'landing'}
                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-slate-200 disabled:opacity-50 disabled:pointer-events-none"
                  >
                     <RefreshCcw className={cn("w-4 h-4", activeDrone.status === 'returning' && "animate-spin")} />
                     {activeDrone.status === 'returning' ? t.returning : t.rth}
                  </button>
                  <button 
                    onClick={() => activeDrone.status === 'active' || activeDrone.status === 'returning' ? handleEmergencyLanding(activeDrone) : toggleMission(activeDrone)}
                    className={cn(
                      "w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95",
                      (activeDrone.status === 'active' || activeDrone.status === 'returning' || activeDrone.status === 'landing') ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-600 text-white"
                    )}
                  >
                     {(activeDrone.status === 'active' || activeDrone.status === 'returning' || activeDrone.status === 'landing') ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                     {(activeDrone.status === 'active' || activeDrone.status === 'returning' || activeDrone.status === 'landing') ? t.emergencyLanding : t.takeoff}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Add Drone Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -translate-y-16 translate-x-16 -z-10" />
              
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-slate-800">Новое устройство</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 active:scale-95 transition-transform">
                  <X />
                </button>
              </div>

              <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
                <button 
                  onClick={() => setConnectionType('scan')}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-xs font-bold transition-all",
                    connectionType === 'scan' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:bg-slate-200"
                  )}
                >
                  Поиск рядом
                </button>
                <button 
                  onClick={() => setConnectionType('manual')}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-xs font-bold transition-all",
                    connectionType === 'manual' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:bg-slate-200"
                  )}
                >
                  Вручную
                </button>
              </div>

              <AnimatePresence mode="wait">
                {connectionType === 'scan' ? (
                  <motion.div 
                    key="scan"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Доступные устройства</label>
                      <button 
                        onClick={startScan}
                        disabled={isScanning}
                        className="text-emerald-600 hover:text-emerald-700 disabled:text-slate-300 transition-colors"
                      >
                        <RefreshCcw className={cn("w-4 h-4", isScanning && "animate-spin")} />
                      </button>
                    </div>
                    
                    {discoveredDrones.length > 0 ? (
                      <div className="space-y-3">
                        {discoveredDrones.map((drone, idx) => (
                          <button
                            key={idx}
                            type="button"
                            disabled={isAdding}
                            onClick={() => handleConnectDiscovered(drone.name)}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-2xl transition-all group active:scale-[0.98]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-emerald-500 shadow-sm border border-slate-100">
                                {drone.type === 'wifi' ? <Wifi className="w-5 h-5" /> : <Bluetooth className="w-5 h-5" />}
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-bold text-slate-700">{drone.name}</p>
                                <p className="text-[10px] text-slate-400 uppercase font-medium">{drone.type === 'wifi' ? 'Wi-Fi Direct' : 'Bluetooth LE'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex gap-0.5 items-end h-3">
                                {[1, 2, 3, 4].map(bar => (
                                  <div 
                                    key={bar} 
                                    className={cn(
                                      "w-1 rounded-full bg-slate-200",
                                      drone.signal >= bar * 25 ? "bg-emerald-500" : "bg-slate-200"
                                    )} 
                                    style={{ height: `${bar * 25}%` }}
                                  />
                                ))}
                              </div>
                              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-300 group-hover:text-emerald-500 border border-slate-100 group-hover:border-emerald-100 transition-all">
                                <Plus className="w-4 h-4" />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : isScanning ? (
                      <div className="p-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <div className="relative w-16 h-16 mx-auto mb-4">
                          <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
                          <div className="relative bg-white rounded-full p-4 shadow-sm border border-slate-100 flex items-center justify-center">
                            <Radar className="w-8 h-8 text-emerald-500 animate-pulse" />
                          </div>
                        </div>
                        <p className="text-sm font-bold text-slate-800">Поиск сигнала...</p>
                        <p className="text-xs text-slate-400 mt-2">Убедитесь, что устройство в режиме сопряжения</p>
                      </div>
                    ) : (
                      <div className="p-12 text-center bg-slate-50 rounded-3xl border border-slate-100">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                          <Wifi className="w-6 h-6 opacity-20" />
                        </div>
                        <p className="text-sm font-bold text-slate-400 italic">Активных устройств не обнаружено</p>
                        <button 
                          onClick={startScan}
                          className="mt-6 text-emerald-600 font-bold text-sm underline active:scale-95"
                        >
                          Повторить поиск
                        </button>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="manual"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <form onSubmit={handleAddDrone} className="space-y-6">
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Имя нового устройства</label>
                        <input 
                          type="text" 
                          value={newDroneName}
                          onChange={(e) => setNewDroneName(e.target.value)}
                          placeholder="Напр: AgroScanner-4"
                          className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800"
                          required
                          autoFocus
                        />
                        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                          Введите уникальное имя для идентификации вашего БПЛА в системе мониторинга.
                        </p>
                      </div>

                      <button 
                        type="submit"
                        disabled={isAdding || !newDroneName.trim()}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3 shadow-lg shadow-slate-200"
                      >
                        {isAdding ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                        {isAdding ? 'Подключение...' : 'Зарегистрировать дрон'}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
