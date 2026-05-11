import os
import re

file_path = r"d:\Antigravity\New folder\MJ-AI\src\main\services\fs-service.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix classifyFileOp
content = content.replace("classifyFileOpen", "classifyFileOp")

# Fix async function scanForIndexing
content = content.replace("async function scanForIndexing(dir: string) {", "const scanForIndexing = async (dir: string) => {")

# Remove the duplicate getSystemPath.
# Let's find getSystemPath and remove all but the first one.
parts = content.split("const getSystemPath = ")
if len(parts) > 2:
    # the first occurrence is module level (we will put it module level later, or just remove the second one)
    # The duplicate is probably:
    # const getSystemPath = (folderName: string) => {
    #   // ...
    # }
    # We can just replace the second one with nothing if we know its shape, but actually they might be in different scopes.
    # Wait, the typescript error was "Cannot redeclare block-scoped variable 'getSystemPath'". That means they are in the same block?
    pass

# A simpler way to remove the second declaration is regex:
# const getSystemPath = (folderName: string) => { ... }
match = re.search(r"const getSystemPath = \(folderName: string\) => \{.*?\n\s+\}", content, re.DOTALL)
if match:
    first_match = match.group(0)
    # find second match
    second_match = re.search(r"const getSystemPath = \(folderName: string\) => \{.*?\n\s+\}", content[match.end():], re.DOTALL)
    if second_match:
        content = content[:match.end() + second_match.start()] + "" + content[match.end() + second_match.end():]

# In fs-service.ts we have 'import fs from "fs/promises"' and 'import fsSync from "fs"'
# But the code uses fs.readFile or fs.promises.readdir depending on what it was originally.
# Let's replace 'import fs from "fs/promises"' with 'import fs from "fs/promises"' but since we have TS1192, we should do:
content = content.replace("import fs from 'fs/promises'", "import * as fs from 'fs/promises'")
content = content.replace("import fsSync from 'fs'", "import * as fsSync from 'fs'")
content = content.replace("import path from 'path'", "import * as path from 'path'")
content = content.replace("import os from 'os'", "import * as os from 'os'")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Fixed fs-service.ts")
