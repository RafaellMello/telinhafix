using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Advanced;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using Vortice.Direct3D;
using Vortice.Direct3D11;
using Vortice.DXGI;

// TelinhaFixScreenHelper: captura um monitor usando a Desktop Duplication
// API (DXGI) e envia os frames como JPEG (com um prefixo de 4 bytes com o
// tamanho) continuamente pro stdout.
//
// A Desktop Duplication API NUNCA inclui o cursor no frame capturado - o
// cursor vem como metadado separado (forma/posicao), e so aparece na
// imagem final se o app que capturou explicitamente desenhar ele por
// cima. Como a gente nunca faz isso aqui, o cursor "fantasma" que o
// capturador padrao do Chromium (WGC/GDI) as vezes desenha por cima da
// captura - mesmo quando o jogo escondeu ele de verdade na tela - nunca
// aparece nessa captura.
//
// Argumentos:
//   list                                  -> lista monitores (JSON) e sai
//   capture <adapterIdx> <outputIdx> <fps> <quality> <maxWidth>
//                                          -> comeca a capturar e transmitir

if (args.Length == 0)
{
    Console.Error.WriteLine("Uso: TelinhaFixScreenHelper.exe list | capture <adapterIdx> <outputIdx> <fps> <quality> <maxWidth>");
    return 1;
}

if (args[0] == "list")
{
    ListMonitors();
    return 0;
}

if (args[0] == "capture")
{
    var adapterIdx = uint.Parse(args[1]);
    var outputIdx = uint.Parse(args[2]);
    var fps = int.Parse(args[3]);
    var quality = long.Parse(args[4]);
    var maxWidth = int.Parse(args[5]);
    Capture(adapterIdx, outputIdx, fps, quality, maxWidth);
    return 0;
}

Console.Error.WriteLine($"Modo desconhecido: {args[0]}");
return 1;

static void ListMonitors()
{
    var monitors = new List<object>();
    using var factory = DXGI.CreateDXGIFactory1<IDXGIFactory1>();

    uint adapterIndex = 0;
    while (factory.EnumAdapters1(adapterIndex, out var adapter).Success)
    {
        uint outputIndex = 0;
        while (adapter!.EnumOutputs(outputIndex, out var output).Success)
        {
            var desc = output!.Description;
            monitors.Add(new
            {
                adapterIndex,
                outputIndex,
                name = desc.DeviceName,
                left = desc.DesktopCoordinates.Left,
                top = desc.DesktopCoordinates.Top,
                width = desc.DesktopCoordinates.Right - desc.DesktopCoordinates.Left,
                height = desc.DesktopCoordinates.Bottom - desc.DesktopCoordinates.Top,
            });
            output.Dispose();
            outputIndex++;
        }
        adapter.Dispose();
        adapterIndex++;
    }

    Console.WriteLine(JsonSerializer.Serialize(monitors));
}

static void Capture(uint adapterIdx, uint outputIdx, int fps, long quality, int maxWidth)
{
    using var factory = DXGI.CreateDXGIFactory1<IDXGIFactory1>();
    var adapterResult = factory.EnumAdapters1(adapterIdx, out var adapter);
    if (!adapterResult.Success || adapter is null)
    {
        Console.Error.WriteLine($"Adaptador {adapterIdx} nao encontrado.");
        return;
    }

    var featureLevels = new[]
    {
        FeatureLevel.Level_11_1,
        FeatureLevel.Level_11_0,
        FeatureLevel.Level_10_1,
        FeatureLevel.Level_10_0,
    };
    var deviceResult = D3D11.D3D11CreateDevice(
        adapter, DriverType.Unknown, DeviceCreationFlags.BgraSupport,
        featureLevels, out var device);
    if (!deviceResult.Success || device is null)
    {
        Console.Error.WriteLine("Falha ao criar o dispositivo Direct3D11: " + deviceResult);
        return;
    }
    var context = device.ImmediateContext;

    var outputResult = adapter.EnumOutputs(outputIdx, out var output);
    if (!outputResult.Success || output is null)
    {
        Console.Error.WriteLine($"Saida {outputIdx} nao encontrada no adaptador {adapterIdx}.");
        return;
    }
    using var output1 = output.QueryInterface<IDXGIOutput1>();
    using var duplication = output1.DuplicateOutput(device);

    var bounds = output.Description.DesktopCoordinates;
    var srcWidth = bounds.Right - bounds.Left;
    var srcHeight = bounds.Bottom - bounds.Top;

    var scale = maxWidth > 0 && srcWidth > maxWidth ? (double)maxWidth / srcWidth : 1.0;
    var dstWidth = Math.Max(2, (int)(srcWidth * scale) & ~1);
    var dstHeight = Math.Max(2, (int)(srcHeight * scale) & ~1);

    Console.Error.WriteLine($"Capturando saida {outputIdx} do adaptador {adapterIdx}: {srcWidth}x{srcHeight} -> {dstWidth}x{dstHeight} @ {fps}fps qualidade {quality}");

    var stagingDesc = new Texture2DDescription
    {
        Width = (uint)srcWidth,
        Height = (uint)srcHeight,
        MipLevels = 1,
        ArraySize = 1,
        Format = Format.B8G8R8A8_UNorm,
        SampleDescription = new SampleDescription(1, 0),
        Usage = ResourceUsage.Staging,
        BindFlags = BindFlags.None,
        CPUAccessFlags = CpuAccessFlags.Read,
        MiscFlags = ResourceOptionFlags.None,
    };
    using var stagingTexture = device.CreateTexture2D(stagingDesc);

    var stdout = Console.OpenStandardOutput();
    var jpegEncoder = new JpegEncoder { Quality = (int)quality };
    var rowBuffer = new byte[srcWidth * 4];

    var frameIntervalMs = 1000.0 / fps;
    var sw = Stopwatch.StartNew();
    var lastFrameTime = 0.0;

    while (true)
    {
        var waitMs = frameIntervalMs - (sw.Elapsed.TotalMilliseconds - lastFrameTime);
        if (waitMs > 1) Thread.Sleep((int)waitMs);

        var acquireResult = duplication.AcquireNextFrame(500, out var frameInfo, out var desktopResource);
        if (!acquireResult.Success)
        {
            // timeout (sem atualizacao de tela) - so tenta de novo.
            continue;
        }

        try
        {
            if (frameInfo.LastPresentTime == 0)
            {
                // nao houve frame novo de verdade, so metadado (ex: so o
                // cursor mudou) - pula, ja que a gente nem desenha cursor.
                continue;
            }

            using var frameTexture = desktopResource!.QueryInterface<ID3D11Texture2D>();
            context.CopyResource(stagingTexture, frameTexture);

            var mapped = context.Map(stagingTexture, 0, MapMode.Read, Vortice.Direct3D11.MapFlags.None);
            try
            {
                using var image = BuildImage(mapped.DataPointer, (int)mapped.RowPitch, srcWidth, srcHeight, rowBuffer);
                if (dstWidth != srcWidth || dstHeight != srcHeight)
                {
                    image.Mutate(x => x.Resize(dstWidth, dstHeight));
                }
                using var ms = new MemoryStream();
                image.SaveAsJpeg(ms, jpegEncoder);
                var jpegBytes = ms.ToArray();

                var lenPrefix = BitConverter.GetBytes(jpegBytes.Length);
                if (BitConverter.IsLittleEndian) Array.Reverse(lenPrefix);
                stdout.Write(lenPrefix, 0, 4);
                stdout.Write(jpegBytes, 0, jpegBytes.Length);
                stdout.Flush();
            }
            finally
            {
                context.Unmap(stagingTexture, 0);
            }

            lastFrameTime = sw.Elapsed.TotalMilliseconds;
        }
        catch (IOException)
        {
            // pipe fechado pelo processo pai - encerra.
            return;
        }
        finally
        {
            desktopResource?.Dispose();
            duplication.ReleaseFrame();
        }
    }
}

static Image<Bgra32> BuildImage(IntPtr src, int srcRowPitch, int srcWidth, int srcHeight, byte[] rowBuffer)
{
    var image = new Image<Bgra32>(srcWidth, srcHeight);
    var rowBytes = srcWidth * 4;
    for (var y = 0; y < srcHeight; y++)
    {
        Marshal.Copy(IntPtr.Add(src, y * srcRowPitch), rowBuffer, 0, rowBytes);
        var destRow = image.DangerousGetPixelRowMemory(y);
        MemoryMarshal.Cast<byte, Bgra32>(rowBuffer.AsSpan(0, rowBytes)).CopyTo(destRow.Span);
    }
    return image;
}
