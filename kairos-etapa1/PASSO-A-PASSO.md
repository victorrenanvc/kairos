# Kairós — como colocar o app no ar (Etapa 1)

Tempo: uns 20 minutos, no computador. Custo: zero.

## Parte A — A planilha e o motor

1. Logado na sua conta pessoal do Google, abra **sheets.new**. Dê o nome **Kairós — dados**.
2. No menu da planilha: **Extensões › Apps Script**.
3. Apague o que estiver escrito, cole todo o conteúdo do arquivo **apps-script/Codigo.gs** e clique no disquete (Salvar). Dê o nome **Kairós** ao projeto.
4. Na barra de cima, escolha a função **configurar** e clique em **Executar**.
   - O Google vai pedir autorização: **Revisar permissões › sua conta › Avançado › Acessar Kairós (não seguro) › Permitir**. É normal: o "não seguro" aparece porque o script é seu, não de uma empresa.
   - Volte para a planilha: devem aparecer as abas Membros, Config, Presencas, Papeis, Lanche e Palavra.
5. No Apps Script: **Implantar › Nova implantação**.
   - Clique na engrenagem e escolha **App da Web**.
   - Descrição: Etapa 1. **Executar como: Eu**. **Quem pode acessar: Qualquer pessoa**.
   - Clique em **Implantar** e **copie o link do App da Web** (termina em `/exec`).

## Parte B — O app no GitHub Pages

6. No github.com: **New repository**. Nome: **kairos**. Deixe **Public**. Clique em **Create repository**.
7. Clique em **uploading an existing file** e arraste tudo o que está dentro da pasta **site** (index.html, config.js, manifest.webmanifest e a pasta icons). Clique em **Commit changes**.
8. Abra o arquivo **config.js** no GitHub, clique no lápis e cole o link do passo 5 entre as aspas:
   `window.KAIROS_API = 'https://script.google.com/macros/s/.../exec';`
   Clique em **Commit changes**.
9. **Settings › Pages**. Em Branch, escolha **main** e **/ (root)**. Clique em **Save**. Em 1 ou 2 minutos o app fica em `https://SEU-USUARIO.github.io/kairos/`.

## Parte C — Primeiro uso

10. Abra o link no iPhone, pelo Safari: **Compartilhar › Adicionar à Tela de Início**. O ícone da ampulheta aparece.
11. **Crie o seu perfil primeiro.** O primeiro perfil vira o líder.
12. Mande o link para o grupo. Cada um cria o perfil e você aprova no **Painel do líder** (botão "Líder" no topo do início).

## Mudar dados do GC
Na aba **Config** da planilha: nome do GC, local, bairro, dia da semana (0 = domingo … 3 = quarta) e hora.

## Quando eu mandar uma versão nova do motor
Cole o Codigo.gs novo, salve e vá em **Implantar › Gerenciar implantações › lápis › Versão: Nova versão › Implantar**. O link continua o mesmo.
