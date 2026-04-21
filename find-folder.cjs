const fs = require('fs');
const path = require('path');
function walk(dir) {
    if (dir.includes('node_modules') || dir.includes('.git') || dir.includes('dist')) return;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        if (file.toLowerCase().includes('new') || file.toLowerCase().includes('file')) {
            console.log("FOUND:", fullPath);
        }
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) walk(fullPath);
    });
}
walk(process.cwd());
