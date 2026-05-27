const fs = require('fs');
const content = fs.readFileSync('src/services/exerciseSeeder.ts', 'utf8');
const urls = content.match(/https:\/\/storage\.googleapis\.com\/exercise-videos-fit\/[^\"]+/g);

if (urls) {
  const counts = {};
  const duplicates = [];
  urls.forEach(url => {
    counts[url] = (counts[url] || 0) + 1;
    if (counts[url] === 2) {
      duplicates.push(url);
    }
  });

  if (duplicates.length > 0) {
    console.log('Duplicate URLs found:');
    duplicates.forEach(url => {
      console.log(`${url} (Count: ${counts[url]})`);
    });
  } else {
    console.log('No duplicate URLs found.');
  }
} else {
  console.log('No URLs found.');
}
