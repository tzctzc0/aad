$projectName = Split-Path (Get-Location) -Leaf
Remove-Item $projectName -Recurse -ErrorAction Ignore
New-Item $projectName -ItemType "directory" -ErrorAction Ignore | Out-Null
$copyTargets = @(
	"manifest.json",
	"popup.html",
	"status-popup.html",
	"offscreen.html",
	"options.html",
	"common.css",
	"dist",
	"style.min.css"
)
foreach ($target in $copyTargets) {
	Copy-Item $target "$projectName\$target" -Recurse -Force
}
Get-ChildItem * -Include *.tsbuildinfo -Recurse | Remove-Item
Remove-Item "$projectName.zip" -ErrorAction Ignore
Compress-Archive $projectName "$projectName.zip"
Remove-Item $projectName -Recurse
