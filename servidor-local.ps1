param([int]$Port = 8080)

$Root = [IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$Address = [Net.IPAddress]::Loopback
$Listener = [Net.Sockets.TcpListener]::new($Address, $Port)
$Mime = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8';
  '.webmanifest'='application/manifest+json; charset=utf-8'; '.svg'='image/svg+xml';
  '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.ico'='image/x-icon';
  '.md'='text/markdown; charset=utf-8'; '.txt'='text/plain; charset=utf-8'
}

function Send-Response($Stream, [int]$Status, [string]$StatusText, [byte[]]$Body, [string]$ContentType) {
  $Header = "HTTP/1.1 $Status $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
  $HeaderBytes = [Text.Encoding]::ASCII.GetBytes($Header)
  $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
  if ($Body.Length -gt 0) { $Stream.Write($Body, 0, $Body.Length) }
  $Stream.Flush()
}

try {
  $Listener.Start()
  $Url = "http://127.0.0.1:$Port/"
  Start-Process $Url
  Write-Host "Aplicación disponible en $Url" -ForegroundColor Green
  Write-Host "Pulsa Ctrl+C para detener el servidor." -ForegroundColor DarkGray

  while ($true) {
    $Client = $Listener.AcceptTcpClient()
    try {
      $Stream = $Client.GetStream()
      $Reader = [IO.StreamReader]::new($Stream, [Text.Encoding]::ASCII, $false, 2048, $true)
      $RequestLine = $Reader.ReadLine()
      while (($Line = $Reader.ReadLine()) -ne $null -and $Line -ne '') { }
      if (-not $RequestLine -or $RequestLine -notmatch '^GET\s+([^\s]+)\s+HTTP/') {
        Send-Response $Stream 400 'Bad Request' ([Text.Encoding]::UTF8.GetBytes('Solicitud no válida')) 'text/plain; charset=utf-8'
        continue
      }

      $RawPath = $Matches[1].Split('?')[0]
      $Decoded = [Uri]::UnescapeDataString($RawPath).TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
      if ([string]::IsNullOrWhiteSpace($Decoded)) { $Decoded = 'index.html' }
      $FilePath = [IO.Path]::GetFullPath((Join-Path $Root $Decoded))

      if (-not $FilePath.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase) -or -not [IO.File]::Exists($FilePath)) {
        Send-Response $Stream 404 'Not Found' ([Text.Encoding]::UTF8.GetBytes('Archivo no encontrado')) 'text/plain; charset=utf-8'
        continue
      }

      $Body = [IO.File]::ReadAllBytes($FilePath)
      $Extension = [IO.Path]::GetExtension($FilePath).ToLowerInvariant()
      $ContentType = if ($Mime.ContainsKey($Extension)) { $Mime[$Extension] } else { 'application/octet-stream' }
      Send-Response $Stream 200 'OK' $Body $ContentType
    } catch {
      Write-Warning $_.Exception.Message
    } finally {
      if ($Reader) { $Reader.Dispose() }
      if ($Stream) { $Stream.Dispose() }
      $Client.Close()
    }
  }
} catch {
  Write-Error "No se pudo iniciar el servidor en el puerto $Port. $($_.Exception.Message)"
  exit 1
} finally {
  $Listener.Stop()
}
