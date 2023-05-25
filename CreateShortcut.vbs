Set fso = CreateObject("Scripting.FileSystemObject")
currentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)

Set oWS = WScript.CreateObject("WScript.Shell")
desktopFolder = oWS.SpecialFolders("Desktop")
sLinkFile = desktopFolder & "\Change background.lnk"

Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = currentDirectory & "\run_silently.vbs"
oLink.HotKey = "ALT+CTRL+B"
oLink.IconLocation = currentDirectory & "\icon.ico"
oLink.Save