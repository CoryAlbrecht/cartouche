const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  // Use ts-morph if available, but it might not be.
  require.resolve('ts-morph');
} catch (e) {
  console.log("Installing ts-morph for JSDoc analysis...");
  execSync('npm install ts-morph --no-save', { stdio: 'inherit' });
}

const { Project, SyntaxKind, TypeGuards } = require('ts-morph');

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

const files = project.getSourceFiles('src/**/*.ts').concat(project.getSourceFiles('src/**/*.tsx'));
let missingCount = 0;
let totalCount = 0;

for (const file of files) {
  const exports = file.getExportedDeclarations();
  for (const [name, declarations] of exports) {
    for (const decl of declarations) {
      if (decl.getKind() === SyntaxKind.VariableDeclaration) {
        // Variables have their jsdocs on the VariableStatement
        const stmt = decl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
        if (stmt) {
          totalCount++;
          const jsDocs = stmt.getJsDocs();
          if (jsDocs.length === 0) {
            console.log(`Missing JSDoc on exported variable: ${name} in ${file.getFilePath()}`);
            missingCount++;
          }
        }
      } else if (decl.getJsDocs) {
        totalCount++;
        const jsDocs = decl.getJsDocs();
        if (jsDocs.length === 0) {
          console.log(`Missing JSDoc on exported ${decl.getKindName()}: ${name} in ${file.getFilePath()}`);
          missingCount++;
        }
      }
    }
  }
}

console.log(`\nAnalysis complete. Found ${totalCount} exported declarations.`);
console.log(`${missingCount} are missing JSDoc comments completely.`);
