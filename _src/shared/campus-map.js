// Normalized anchors against the supplied Dolphin campus composition, not 3D coordinates.
// Map positions are a navigation atlas. The existing local plaza coordinates are unchanged.
export const CAMPUS_LOCATIONS=Object.freeze([
 {id:'plaza',title:'Orb Plaza',subtitle:'The center of AUREVIA',x:.546,y:.382,icon:'sparkle',access:'playable',activities:'Explore the actual 3D plaza, meet your companions and navigate the world.'},
 {id:'residence',title:'Your Residence',subtitle:'Your personal coastal space',x:.30,y:.34,icon:'home',access:'settings',activities:'Manage your private residence name and saved preferences. The playable interior and furniture customization are still in development.'},
 {id:'office',title:'Principal’s Office',subtitle:'Conversations & private meetings',x:.506,y:.527,icon:'agents',access:'meeting',activities:'Open the existing 3D office, invite companions, continue authorized conversations and save meeting records.'},
 {id:'university',title:'AELIO University',subtitle:'Learning & creator programs',x:.57,y:.19,icon:'bulb',access:'learning',activities:'Open the learning workspace and project-memory tools. Courses, exams, graduation and the 3D university are not available yet.'},
 {id:'terraces',title:'The Terraces',subtitle:'Executive housing & guest suites',x:.31,y:.18,icon:'home',access:'planned',activities:'This destination is planned. It is not a completed playable environment.'},
 {id:'court',title:'The Courthouse',subtitle:'Governance & community',x:.79,y:.22,icon:'library',access:'planned',activities:'This destination is planned. No court assignment, examination or outcome is simulated.'},
 {id:'harbor',title:'The Harbor',subtitle:'Waterfront & marina',x:.67,y:.86,icon:'compass',access:'planned',activities:'The waterfront destination is in development.'},
 {id:'academic',title:'Academic Core',subtitle:'Classrooms & innovation labs',x:.28,y:.48,icon:'library',access:'planned',activities:'Academic spaces are in development. Your existing saved learning plans remain available.'},
 {id:'student-life',title:'Student Life Courtyard',subtitle:'Dining & social spaces',x:.47,y:.34,icon:'agents',access:'planned',activities:'Student-life activities are in development.'},
 {id:'athletics',title:'Athletics + Community',subtitle:'Training & campus events',x:.73,y:.57,icon:'sparkle',access:'planned',activities:'Athletics activities are in development. No event attendance or live population is fabricated.'},
 {id:'culture',title:'Culture + Recreation',subtitle:'Performing arts & galleries',x:.88,y:.28,icon:'sparkle',access:'planned',activities:'Performing arts and galleries are in development.'},
 {id:'wellness',title:'Wellness Center',subtitle:'Fitness & wellbeing',x:.93,y:.43,icon:'bulb',access:'planned',activities:'Wellness activities are in development.'},
 {id:'dining',title:'Dining District',subtitle:'Restaurants & cafés',x:.29,y:.73,icon:'home',access:'planned',activities:'Dining activities are in development.'},
 {id:'dolphins',title:'Dolphin Pride Plaza',subtitle:'Campus gathering & waterfront',x:.835,y:.685,icon:'compass',access:'planned',activities:'The Dolphins are AUREVIA’s campus identity. This gathering space is in development.'},
 {id:'entry',title:'South Campus Entry',subtitle:'Visitor entrance',x:.515,y:.84,icon:'compass',access:'planned',activities:'Use Orb Plaza as the current playable arrival point.'},
]);
export const campusLocation=id=>CAMPUS_LOCATIONS.find(d=>d.id===id);
export const mapZoom=n=>Math.max(.4,Math.min(3,n));
