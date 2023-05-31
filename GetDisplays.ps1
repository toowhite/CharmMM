[System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms") | Out-Null
powershell Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens
