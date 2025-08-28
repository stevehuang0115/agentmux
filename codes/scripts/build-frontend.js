#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Building integrated frontend...');

const projectRoot = path.join(__dirname, '..');
const frontendDir = path.join(projectRoot, 'frontend');
const publicDir = path.join(projectRoot, 'public');

// Check if frontend directory exists
if (!fs.existsSync(frontendDir)) {
  console.error('❌ Frontend directory not found!');
  process.exit(1);
}

try {
  // Build the Next.js frontend (with output: 'export' it will auto-export)
  console.log('📦 Building Next.js frontend...');
  process.chdir(frontendDir);
  execSync('npm run build', { stdio: 'inherit' });

  // Clean up old React build in public directory
  console.log('🧹 Cleaning up old files...');
  const reactBuildPath = path.join(publicDir, 'react');
  if (fs.existsSync(reactBuildPath)) {
    fs.rmSync(reactBuildPath, { recursive: true, force: true });
  }

  // Copy exported files to public directory
  console.log('📂 Copying build files...');
  const outDir = path.join(frontendDir, 'out');
  if (fs.existsSync(outDir)) {
    // Create react subdirectory
    fs.mkdirSync(reactBuildPath, { recursive: true });
    
    // Copy all files from out to public/react
    const copyRecursively = (src, dest) => {
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
          fs.mkdirSync(destPath, { recursive: true });
          copyRecursively(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };

    copyRecursively(outDir, reactBuildPath);

    // Also copy the main index.html to public root for direct access
    const indexSrc = path.join(outDir, 'index.html');
    const indexDest = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexSrc)) {
      fs.copyFileSync(indexSrc, indexDest);
    }

    console.log('✅ Frontend build completed successfully!');
    console.log('📍 Files copied to:', reactBuildPath);
    console.log('🌐 Main index.html copied to:', indexDest);
  } else {
    console.error('❌ Next.js export directory not found!');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}