
// global.d.ts
export {}; // Ensure this file is treated as a module.

declare global {
  interface BluetoothDevice extends EventTarget {
    readonly id: string;
    readonly name?: string | undefined;
    readonly gatt?: BluetoothRemoteGATTServer | undefined;
    watchAdvertisements(options?: WatchAdvertisementsOptions): Promise<void>;
    readonly watchingAdvertisements: boolean;
    onavailabilitychanged: ((this: BluetoothDevice, ev: Event) => any) | null;
    ongattserverdisconnected: ((this: BluetoothDevice, ev: Event) => any) | null;
    onadvertisementreceived: ((this: BluetoothDevice, ev: BluetoothAdvertisingEvent) => any) | null;
    addEventListener<K extends keyof BluetoothDeviceEventMap>(type: K, listener: (this: BluetoothDevice, ev: BluetoothDeviceEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof BluetoothDeviceEventMap>(type: K, listener: (this: BluetoothDevice, ev: BluetoothDeviceEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
  }

  interface BluetoothRemoteGATTServer {
    readonly device: BluetoothDevice;
    readonly connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
    getPrimaryServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
  }

  interface BluetoothRemoteGATTService extends EventTarget {
    readonly uuid: string;
    readonly device: BluetoothDevice;
    readonly isPrimary: boolean;
    getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
    getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic[]>;
    getIncludedService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
    getIncludedServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
    oncharacteristicvaluechanged: ((this: BluetoothRemoteGATTService, ev: Event) => any) | null;
    onserviceadded: ((this: BluetoothRemoteGATTService, ev: Event) => any) | null;
    onservicechanged: ((this: BluetoothRemoteGATTService, ev: Event) => any) | null;
    onserviceremoved: ((this: BluetoothRemoteGATTService, ev: Event) => any) | null;
  }

  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    readonly service: BluetoothRemoteGATTService;
    readonly uuid: string;
    readonly properties: BluetoothCharacteristicProperties;
    readonly value?: DataView | undefined;
    getDescriptor(descriptor: BluetoothDescriptorUUID): Promise<BluetoothRemoteGATTDescriptor>;
    getDescriptors(descriptor?: BluetoothDescriptorUUID): Promise<BluetoothRemoteGATTDescriptor[]>;
    readValue(): Promise<DataView>;
    writeValue(value: BufferSource): Promise<void>;
    writeValueWithResponse(value: BufferSource): Promise<void>;
    writeValueWithoutResponse(value: BufferSource): Promise<void>;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    oncharacteristicvaluechanged: ((this: BluetoothRemoteGATTCharacteristic, ev: Event) => any) | null;
    addEventListener<K extends keyof BluetoothRemoteGATTCharacteristicEventMap>(type: K, listener: (this: BluetoothRemoteGATTCharacteristic, ev: BluetoothRemoteGATTCharacteristicEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof BluetoothRemoteGATTCharacteristicEventMap>(type: K, listener: (this: BluetoothRemoteGATTCharacteristic, ev: BluetoothRemoteGATTCharacteristicEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
  }
  
  interface BluetoothRemoteGATTDescriptor {
    readonly characteristic: BluetoothRemoteGATTCharacteristic;
    readonly uuid: string;
    readonly value?: DataView;
    readValue(): Promise<DataView>;
    writeValue(value: BufferSource): Promise<void>;
  }


  type BluetoothServiceUUID = number | string;
  type BluetoothCharacteristicUUID = number | string;
  type BluetoothDescriptorUUID = number | string;

  interface BluetoothCharacteristicProperties {
    readonly broadcast: boolean;
    readonly read: boolean;
    readonly writeWithoutResponse: boolean;
    readonly write: boolean;
    readonly notify: boolean;
    readonly indicate: boolean;
    readonly authenticatedSignedWrites: boolean;
    readonly reliableWrite: boolean;
    readonly writableAuxiliaries: boolean;
  }

  interface Navigator {
    bluetooth: Bluetooth;
  }

  interface Bluetooth extends EventTarget {
    getAvailability(): Promise<boolean>;
    onavailabilitychanged: ((this: Bluetooth, ev: Event) => any) | null;
    readonly referringDevice?: BluetoothDevice | undefined;
    requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
    getDevices(): Promise<BluetoothDevice[]>;
    requestLEScan(options?: BluetoothLEScanOptions): Promise<BluetoothLEScan>;
    addEventListener<K extends keyof BluetoothEventMap>(type: K, listener: (this: Bluetooth, ev: BluetoothEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof BluetoothEventMap>(type: K, listener: (this: Bluetooth, ev: BluetoothEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
  }
  
  interface BluetoothLEScan extends BluetoothLEScanOperations {
    readonly active: boolean;
    readonly filters?: BluetoothLEScanFilter[] | undefined;
    readonly keepRepeatedDevices?: boolean | undefined;
    readonly options?: BluetoothLEScanOptions | undefined;
    stop(): void;
  }
  interface BluetoothLEScanOperations {}


  interface RequestDeviceOptions {
    filters?: BluetoothLEScanFilter[] | undefined;
    optionalServices?: BluetoothServiceUUID[] | undefined;
    acceptAllDevices?: boolean | undefined;
    optionalManufacturerData?: number[] | undefined;
  }

  interface BluetoothLEScanFilter {
    name?: string | undefined;
    namePrefix?: string | undefined;
    services?: BluetoothServiceUUID[] | undefined;
    manufacturerData?: BluetoothManufacturerDataFilter | undefined;
    serviceData?: BluetoothServiceDataFilter[] | undefined;
  }
  interface BluetoothManufacturerDataFilter extends BluetoothDataFilterInit {}
  interface BluetoothServiceDataFilter extends BluetoothDataFilterInit {}

  interface BluetoothDataFilterInit {
    dataPrefix?: BufferSource | undefined;
    mask?: BufferSource | undefined;
  }
  interface BluetoothLEScanOptions {
    keepRepeatedDevices?: boolean;
    acceptAllAdvertisements?: boolean;
  }
  
  interface BluetoothDeviceEventMap {
    "advertisementreceived": BluetoothAdvertisingEvent;
    "gattserverdisconnected": Event;
    "availabilitychanged": Event; // Added based on common usage, might need specific event type
  }

  interface BluetoothRemoteGATTCharacteristicEventMap {
    "characteristicvaluechanged": Event;
  }

  interface BluetoothEventMap {
    "availabilitychanged": Event;
    "advertisementreceived": BluetoothAdvertisingEvent; // Added for completeness
  }

  interface BluetoothAdvertisingEvent extends Event {
    readonly device: BluetoothDevice;
    readonly rssi?: number | undefined;
    readonly txPower?: number | undefined;
    readonly uuids?: BluetoothServiceUUID[] | undefined;
    readonly appearance?: number | undefined;
    readonly manufacturerData?: Map<number, DataView> | undefined;
    readonly serviceData?: Map<string, DataView> | undefined;
  }

  interface WatchAdvertisementsOptions {
    signal?: AbortSignal;
  }
}
