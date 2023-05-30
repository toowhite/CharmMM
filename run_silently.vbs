appFolder = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
Set objShell = WScript.CreateObject("WScript.Shell")
objShell.Run "node " + appFolder + "\app.mjs", 2, true