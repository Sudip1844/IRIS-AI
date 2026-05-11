import re

file_path = r"d:\Antigravity\New folder\MJ-AI\src\main\services\fs-service.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("import * as fs from 'fs/promises'", "import fs from 'fs/promises'")
content = content.replace("import * as fsSync from 'fs'", "import fsSync from 'fs'")
content = content.replace("import * as path from 'path'", "import path from 'path'")
content = content.replace("import * as os from 'os'", "import os from 'os'")

# Fix duplicate getSystemPath
matches = list(re.finditer(r"const getSystemPath = \(folderName: string\) => \{.*?\n\s+\}", content, re.DOTALL))
if len(matches) > 1:
    second_match = matches[1]
    content = content[:second_match.start()] + "" + content[second_match.end():]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Fixed fs-service.ts imports")
