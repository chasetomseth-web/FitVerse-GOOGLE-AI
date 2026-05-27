
const fs = require('fs');
const content = fs.readFileSync('src/services/exerciseSeeder.ts', 'utf8');
const urls = content.match(/https:\/\/storage\.googleapis\.com\/exercise-videos-fit\/[^\"]*/g);
const duplicates = urls.filter((item, index) => urls.indexOf(item) !== index);
console.log(JSON.stringify(duplicates, null, 2));
