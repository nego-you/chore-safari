const ts = require("./node_modules/typescript");
const fs = require("fs");
const f = "app/kids/WorldMapPortal.tsx";
const src = fs.readFileSync(f, "utf8");
const out = ts.transpileModule(src, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  reportDiagnostics: true, fileName: f,
});
const diags = (out.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
if (!diags.length) console.log("SYNTAX OK");
else for (const d of diags) {
  const p = d.file ? d.file.getLineAndCharacterOfPosition(d.start) : null;
  console.log("ERR", p ? (p.line+1)+":"+(p.character+1):"", ts.flattenDiagnosticMessageText(d.messageText,"\n"));
}
