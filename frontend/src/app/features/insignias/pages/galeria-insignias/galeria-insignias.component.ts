import { Component } from '@angular/core';

interface InsigniaInfo {
  tipo: string;
  emoji: string;
  color: string;
  gradiente: string;
  requisitos: string[];
  descripcion: string;
  nivel: number;
}

@Component({
  selector: 'app-galeria-insignias',
  templateUrl: './galeria-insignias.component.html',
})
export class GaleriaInsigniasComponent {
  insignias: InsigniaInfo[] = [
    {
      tipo: 'Obsidiana',
      emoji: '🖤',
      color: '#546E7A',
      gradiente: 'linear-gradient(135deg, #263238, #546E7A)',
      nivel: 1,
      descripcion: 'Primera insignia del programa. Demuestra compromiso con el desarrollo personal y comunitario.',
      requisitos: [
        '3 Senderos completados (5 caminos c/u)',
        '3 Especialidades completadas',
        'Aventura TerraNova + 1 aventura adicional',
        'Punta de Flecha (Participación)',
        '2 Iniciativas Mundiales',
        '2 Eventos (Provincia/Nacional/Internacional)',
        'Mínimo 1.5 años en el programa',
      ],
    },
    {
      tipo: 'Jade',
      emoji: '💚',
      color: '#2E7D32',
      gradiente: 'linear-gradient(135deg, #1B5E20, #43A047)',
      nivel: 2,
      descripcion: 'Segunda insignia. Otorga el derecho a la Camisola Scouts. Muestra liderazgo y compromiso avanzado.',
      requisitos: [
        '4 Senderos completados (todos)',
        '4 Especialidades completadas',
        'Aventura TerraNova + 2 aventuras adicionales',
        'Punta de Flecha (Certificación)',
        '3 Iniciativas Mundiales',
        '3 Eventos (al menos uno Nacional)',
        'Mínimo 2 años en el programa',
        'Se otorga la Camisola Scouts',
      ],
    },
    {
      tipo: 'Ópalo',
      emoji: '💜',
      color: '#7B1FA2',
      gradiente: 'linear-gradient(135deg, #4A148C, #9C27B0)',
      nivel: 3,
      descripcion: 'Tercera insignia. Representa un nivel avanzado de desarrollo y servicio comunitario.',
      requisitos: [
        '4 Senderos completados',
        '5 Especialidades completadas',
        'TerraNova + 3 aventuras adicionales',
        'Punta de Flecha (Certificación)',
        '4 Iniciativas Mundiales',
        '4 Eventos (incluye Internacional)',
        'Mínimo 2.5 años en el programa',
      ],
    },
    {
      tipo: 'Diamante',
      emoji: '💎',
      color: '#1565C0',
      gradiente: 'linear-gradient(135deg, #0D47A1, #1976D2)',
      nivel: 4,
      descripcion: 'La insignia más alta. Máxima expresión del espíritu scout en la Comunidad de Caminantes.',
      requisitos: [
        '4 Senderos completados',
        '6 Especialidades completadas',
        'TerraNova + 3 aventuras adicionales',
        'Punta de Flecha (Certificación)',
        '5 Iniciativas Mundiales (todas)',
        '5 Eventos (Provincial, Nacional e Internacional)',
        'Mínimo 3 años en el programa',
      ],
    },
  ];

  senderos = [
    {
      nombre: 'Cenit',
      tema: 'Salud y Bienestar',
      icon: '❤️',
      color: '#FF7043',
      caminos: ['Alimentación Saludable', 'Actividad Física', 'Salud Mental', 'Primeros Auxilios', 'Higiene y Prevención'],
    },
    {
      nombre: 'Cima',
      tema: 'Medio Ambiente',
      icon: '🌿',
      color: '#43A047',
      caminos: ['Biodiversidad', 'Cambio Climático', 'Agua y Océanos', 'Residuos y Reciclaje', 'Energía Renovable'],
    },
    {
      nombre: 'Cumbre',
      tema: 'Paz y Participación Comunitaria',
      icon: '🕊️',
      color: '#1E88E5',
      caminos: ['Ciudadanía Activa', 'Derechos Humanos', 'Resolución de Conflictos', 'Liderazgo Comunitario', 'Servicio Social'],
    },
    {
      nombre: 'Cúspide',
      tema: 'Habilidades para la Vida',
      icon: '⚡',
      color: '#8E24AA',
      caminos: ['Comunicación Efectiva', 'Emprendimiento', 'Tecnología Digital', 'Gestión del Tiempo', 'Pensamiento Crítico'],
    },
  ];

  aventuras = [
    { nombre: 'Terra Nova', icon: '🏕️', desc: 'Aventura en tierra firme. Obligatoria para todas las insignias.' },
    { nombre: 'Kon-Tiki', icon: '⛵', desc: 'Aventura acuática. Exploración en ríos, lagos o mares.' },
    { nombre: '7 Cimas', icon: '🏔️', desc: 'Aventura de montaña y senderismo de alto nivel.' },
    { nombre: 'Discovery', icon: '🧭', desc: 'Aventura de exploración y descubrimiento del entorno.' },
  ];

  iniciativas = [
    { nombre: 'Mensajeros de la Paz', icon: '🕊️', codigo: 'MOP' },
    { nombre: 'Champions for Nature', icon: '🌍', codigo: 'ChampionsForNature' },
    { nombre: 'Plastic Tide Turners', icon: '♻️', codigo: 'PlasticTideTurners' },
    { nombre: 'Scouts Go Solar', icon: '☀️', codigo: 'ScoutsGoSolar' },
    { nombre: 'Acciones Humanitarias', icon: '🤝', codigo: 'AccionesHumanitarias' },
  ];
}
