// Test the new findFailUpload logic with sample snapshot data
const sampleSnapshot = `
- listitem:
  - img "20180620_141847.jpg"
  - text: 20180620_141847.jpg
  - button "Remove Video" [ref=e98]
  - text: Upload failed
- listitem:
  - img "20180620_142931.jpg"
  - text: 20180620_142931.jpg
  - button "Remove Video" [ref=e99]
  - text: Upload failed
`;

// Simulate the new parsing logic
const results = [];
const lines = sampleSnapshot.split('\n');

for (let i = 0; i < lines.length - 1; i++) {
    const currentLine = lines[i].trim();
    const imgMatch = currentLine.match(/img "(.*?\.jpg)"/);
    if (imgMatch) {
        const filename = imgMatch[1];
        console.log(`Found JPG: ${filename}`);
        
        // Look for the Remove Video button in the next few lines
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const buttonLine = lines[j].trim();
            const buttonMatch = buttonLine.match(/- button "Remove Video" \[ref=([e\d]+)\]/);
            if (buttonMatch) {
                const ref = buttonMatch[1];
                console.log(`  Found Remove Video button: ${ref}`);
                results.push({ ref, filename });
                break;
            }
        }
    }
}

console.log('\nResults:');
results.forEach(result => {
    console.log(`File: ${result.filename}, Ref: ${result.ref}`);
});