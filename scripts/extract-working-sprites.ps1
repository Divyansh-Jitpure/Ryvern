param(
  [string]$Source = "public/sprites/ryvern/working-sheet-v2-chroma.png",
  [string]$OutputDirectory = "public/sprites/ryvern"
)

Add-Type -AssemblyName System.Drawing

$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$outputPath = (Resolve-Path -LiteralPath $OutputDirectory).Path
$sourceBitmap = [System.Drawing.Bitmap]::new($sourcePath)
$columns = 3
$rows = 2
$cellWidth = [math]::Floor($sourceBitmap.Width / $columns)
$cellHeight = [math]::Floor($sourceBitmap.Height / $rows)

# Every generated pose shares this crop within its cell. A shared crop keeps
# scale and baseline stable instead of tightly fitting each changing paw pose.
$crop = [System.Drawing.Rectangle]::new(76, 108, 412, 372)
$transparentDistance = 10
$opaqueDistance = 140

try {
  for ($index = 0; $index -lt $columns * $rows; $index++) {
    $column = $index % $columns
    $row = [math]::Floor($index / $columns)
    # The generator placed the second row higher inside its 512 px cells.
    # Normalize that offset while retaining one shared output baseline.
    $sourceCropTop = if ($row -eq 0) { $crop.Y } else { 24 }
    $cutout = [System.Drawing.Bitmap]::new(
      $crop.Width,
      $crop.Height,
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )

    try {
      for ($y = 0; $y -lt $crop.Height; $y++) {
        for ($x = 0; $x -lt $crop.Width; $x++) {
          $pixel = $sourceBitmap.GetPixel(
            $column * $cellWidth + $crop.X + $x,
            $row * $cellHeight + $sourceCropTop + $y
          )
          $distance = [math]::Sqrt(
            [math]::Pow($pixel.R, 2) +
            [math]::Pow(255 - $pixel.G, 2) +
            [math]::Pow($pixel.B, 2)
          )
          $alpha = [math]::Max(
            0,
            [math]::Min(
              255,
              [int](
                ($distance - $transparentDistance) /
                ($opaqueDistance - $transparentDistance) *
                255
              )
            )
          )

          # Remove green spill from partially transparent edge pixels.
          $despilledGreen = [math]::Min(
            $pixel.G,
            [math]::Max($pixel.R, $pixel.B)
          )
          $cutout.SetPixel(
            $x,
            $y,
            [System.Drawing.Color]::FromArgb(
              $alpha,
              $pixel.R,
              $despilledGreen,
              $pixel.B
            )
          )
        }
      }

      $frame = [System.Drawing.Bitmap]::new(
        48,
        48,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
      )

      try {
        $graphics = [System.Drawing.Graphics]::FromImage($frame)
        try {
          $graphics.InterpolationMode =
            [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
          $destinationWidth = 46
          $destinationHeight = [math]::Round(
            $destinationWidth * $crop.Height / $crop.Width
          )
          $graphics.DrawImage(
            $cutout,
            [System.Drawing.Rectangle]::new(
              1,
              47 - $destinationHeight,
              $destinationWidth,
              $destinationHeight
            ),
            0,
            0,
            $crop.Width,
            $crop.Height,
            [System.Drawing.GraphicsUnit]::Pixel
          )
        } finally {
          $graphics.Dispose()
        }

        $frameNumber = $index + 1
        $destination = Join-Path $outputPath "working-$frameNumber.png"
        $frame.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $frame.Dispose()
      }
    } finally {
      $cutout.Dispose()
    }
  }
} finally {
  $sourceBitmap.Dispose()
}
