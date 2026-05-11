import os
import re

file_path = r"d:\Antigravity\New folder\MJ-AI\src\main\services\fs-service.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix fs.promises -> fs
content = content.replace("fs.promises.", "fs.")

# Fix fs.existsSync -> fsSync.existsSync
content = content.replace("fs.existsSync", "fsSync.existsSync")

# Fix duplicate getSystemPath
match = re.search(r"const getSystemPath = \(folderName: string\) => \{.*?\n\s+\}", content, re.DOTALL)
if match:
    # find second match
    second_match = re.search(r"const getSystemPath = \(folderName: string\) => \{.*?\n\s+\}", content[match.end():], re.DOTALL)
    if second_match:
        # replace second match with nothing
        content = content[:match.end() + second_match.start()] + "" + content[match.end() + second_match.end():]

# In strict mode, 'import Groq from "groq-sdk"' actually needs `esModuleInterop` but maybe it works if I just change it to `const Groq = require('groq-sdk')` or something. I'll leave Groq for now since it wasn't mentioned in the last typescript error output.

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Fixed fs-service.ts again")
