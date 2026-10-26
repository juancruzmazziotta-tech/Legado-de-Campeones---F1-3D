import { CarSpecs, CircuitInfo } from '../types/game';

export const CARS_DATA: CarSpecs[] = [
  {
    id: 'f1_2022',
    name: 'F1 2022 Genérico',
    team: 'F1 Ground Effect Concept',
    driver: 'Piloto Oficial F1 #1',
    era: 'Efecto Suelo (2022)',
    primaryColor: '#002B49',
    secondaryColor: '#FF1801',
    accentColor: '#00D2BE',
    topSpeed: 352,
    acceleration: 2.2,
    handling: 9.5,
    powerUnit: '1.6L V6 Turbo Híbrido MGU-K + MGU-H',
    description: 'Reglamento de efecto suelo con túneles Venturi, alerones estilizados y halo de titanio.',
    glbFile: 'f1_2022_generic.glb',
  },
  {
    id: 'ferrari_2004',
    name: 'Ferrari F2004',
    team: 'Scuderia Ferrari',
    driver: 'Michael Schumacher #1',
    era: 'Era V10 (2004)',
    primaryColor: '#E10600',
    secondaryColor: '#FFFFFF',
    accentColor: '#FFD700',
    topSpeed: 362,
    acceleration: 2.1,
    handling: 9.6,
    powerUnit: 'Ferrari 053 3.0L V10 Atmosférico (19.000 RPM)',
    description: 'El legendario e invencible bólido con el que Schumacher arrasó el campeonato mundial.',
    glbFile: '2004_ferrari_f2004.glb',
  },
];

export const CIRCUITS_DATA: CircuitInfo[] = [
  {
    id: 'imola',
    name: 'Autodromo Enzo e Dino Ferrari (Ímola)',
    country: 'Italia',
    length: '4.909 km',
    corners: 19,
    drsZones: 1,
    lapRecord: '1:15.484 (Lewis Hamilton)',
    description: 'Templo sagrado del automovilismo italiano con Tamburello, Villeneuve, Tosa y Rivazza.',
    backgroundColor: '#1E2522',
    glbFile: 'imola_circuit_2024_layout.glb',
  },
  {
    id: 'spa',
    name: 'Circuit de Spa-Francorchamps',
    country: 'Bélgica',
    length: '7.004 km',
    corners: 20,
    drsZones: 2,
    lapRecord: '1:46.286 (Valtteri Bottas)',
    description: 'El legendario trazado de las Ardenas con la mítica subida de Eau Rouge, Raidillon, Blanchimont y Kemmel Straight.',
    backgroundColor: '#231F20',
    glbFile: 'circuit_de_spa-francorchamps_2022_layout.glb',
  },
];

