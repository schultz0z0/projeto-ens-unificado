# graduação-test

Pacote de exemplo para gerar uma arte no estilo do anexo usando o `picture-it`.

Arquivos:
- `prompt.txt`: prompt base para gerar o fundo com IA
- `overlays.json`: layout completo com gradiente, badge, titulo, subtitulo e CTAs
- `text-only.json`: apenas as camadas de texto para teste com `text --jsx`
- `steps.json`: pipeline pronto para gerar fundo + aplicar grade + compor overlays
- `assets/ens-logo-white.png`: logo real da ENS usada no badge superior

Tipografia:
- O pacote foi ajustado para usar `Outfit` nos textos.
- Se a fonte ainda nao estiver instalada localmente, rode `download-fonts` antes dos testes.

Comandos:

Gerar a peca completa com IA:

```powershell
& "C:\Users\raphaeloliveira\.bun\bin\bun.exe" run index.ts pipeline --spec "graduação-test/steps.json" -o "graduação-test.png"
```

Aplicar o layout completo em cima de uma imagem existente:

```powershell
& "C:\Users\raphaeloliveira\.bun\bin\bun.exe" run index.ts compose -i "Graduação-geral-1080x1080-1 (3).png" --overlays "graduação-test/overlays.json" -o "graduação-test-compose.png"
```

Aplicar apenas os textos em cima de uma imagem existente:

```powershell
& "C:\Users\raphaeloliveira\.bun\bin\bun.exe" run index.ts text -i "Graduação-geral-1080x1080-1 (3).png" --jsx "graduação-test/text-only.json" -o "graduação-test-text.png"
```

Notas:
- O pipeline usa `banana-pro` para tentar uma base mais proxima de peca publicitaria institucional.
- O texto final fica mais estavel quando vai por `compose` do que quando vai dentro do prompt.
- Os caminhos em `steps.json` foram feitos para rodar a partir da raiz do projeto.
