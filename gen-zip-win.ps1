$projectName = Split-Path (Get-Location) -Leaf
Remove-Item $projectName -Recurse -ErrorAction Ignore
New-Item $projectName -ItemType "directory" -ErrorAction Ignore | Out-Null
Copy-Item .\manifest.json $projectName\manifest.json -Force
Copy-Item .\popup.html $projectName\popup.html -Force
Copy-Item .\dist $projectName\dist -Recurse -Force
Copy-Item .\style.min.css $projectName\style.min.css -Force
Remove-Item "$projectName.zip" -ErrorAction Ignore
Compress-Archive $projectName "$projectName.zip"
Remove-Item $projectName -Recurse
