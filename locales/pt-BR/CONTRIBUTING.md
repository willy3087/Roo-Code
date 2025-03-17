# Contribuindo para o Roo Code

Estamos entusiasmados por você estar interessado em contribuir para o Roo Code. Seja corrigindo um bug, adicionando um recurso ou melhorando nossa documentação, cada contribuição torna o Roo Code mais inteligente! Para manter nossa comunidade vibrante e acolhedora, todos os membros devem aderir ao nosso [Código de Conduta](CODE_OF_CONDUCT.md).

## Junte-se à Nossa Comunidade

Incentivamos fortemente todos os colaboradores a se juntarem à nossa [comunidade no Discord](https://discord.gg/roocode)! Fazer parte do nosso servidor Discord ajuda você a:

- Obter ajuda e orientação em tempo real sobre suas contribuições
- Conectar-se com outros colaboradores e membros da equipe principal
- Manter-se atualizado sobre os desenvolvimentos e prioridades do projeto
- Participar de discussões que moldam o futuro do Roo Code
- Encontrar oportunidades de colaboração com outros desenvolvedores

## Relatando Bugs ou Problemas

Relatórios de bugs ajudam a tornar o Roo Code melhor para todos! Antes de criar uma nova issue, por favor [pesquise as existentes](https://github.com/RooVetGit/Roo-Code/issues) para evitar duplicatas. Quando estiver pronto para relatar um bug, vá para nossa [página de issues](https://github.com/RooVetGit/Roo-Code/issues/new/choose) onde você encontrará um modelo para ajudá-lo a preencher as informações relevantes.

<blockquote class='warning-note'>
     🔐 <b>Importante:</b> Se você descobrir uma vulnerabilidade de segurança, por favor use a <a href="https://github.com/RooVetGit/Roo-Code/security/advisories/new">ferramenta de segurança do Github para relatá-la de forma privada</a>.
</blockquote>

## Decidindo no que Trabalhar

Procurando uma boa primeira contribuição? Verifique as issues na seção "Issue [Unassigned]" do nosso [Projeto Github Roo Code](https://github.com/orgs/RooVetGit/projects/1). Estas são especialmente selecionadas para novos colaboradores e áreas onde gostaríamos de ter alguma ajuda!

Também damos as boas-vindas a contribuições para nossa [documentação](https://docs.roocode.com/)! Seja corrigindo erros de digitação, melhorando guias existentes ou criando novo conteúdo educacional - adoraríamos construir um repositório de recursos impulsionado pela comunidade que ajude todos a obter o máximo do Roo Code. Você pode clicar em "Edit this page" em qualquer página para ir rapidamente ao local certo no Github para editar o arquivo, ou pode mergulhar diretamente em https://github.com/RooVetGit/Roo-Code-Docs.

Se você está planejando trabalhar em um recurso maior, por favor crie primeiro uma [solicitação de recurso](https://github.com/RooVetGit/Roo-Code/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop) para que possamos discutir se está alinhado com a visão do Roo Code.

## Configuração de Desenvolvimento

1. **Clone** o repositório:

```sh
git clone https://github.com/RooVetGit/Roo-Code.git
```

2. **Instale as dependências**:

```sh
npm run install:all
```

3. **Inicie o webview (aplicativo Vite/React com HMR)**:

```sh
npm run dev
```

4. **Depuração**:
   Pressione `F5` (ou **Executar** → **Iniciar Depuração**) no VSCode para abrir uma nova sessão com o Roo Code carregado.

Alterações no webview aparecerão imediatamente. Alterações na extensão principal exigirão a reinicialização do host da extensão.

Alternativamente, você pode construir um .vsix e instalá-lo diretamente no VSCode:

```sh
npm run build
```

Um arquivo `.vsix` aparecerá no diretório `bin/` que pode ser instalado com:

```sh
code --install-extension bin/roo-cline-<version>.vsix
```

## Escrevendo e Enviando Código

Qualquer pessoa pode contribuir com código para o Roo Code, mas pedimos que você siga estas diretrizes para garantir que suas contribuições possam ser integradas sem problemas:

1. **Mantenha os Pull Requests Focados**

    - Limite os PRs a um único recurso ou correção de bug
    - Divida mudanças maiores em PRs menores e relacionados
    - Divida as mudanças em commits lógicos que possam ser revisados independentemente

2. **Qualidade do Código**

    - Todos os PRs devem passar nas verificações de CI que incluem tanto linting quanto formatação
    - Resolva quaisquer avisos ou erros do ESLint antes de enviar
    - Responda a todos os feedbacks do Ellipsis, nossa ferramenta automatizada de revisão de código
    - Siga as melhores práticas de TypeScript e mantenha a segurança de tipos

3. **Testes**

    - Adicione testes para novos recursos
    - Execute `npm test` para garantir que todos os testes passem
    - Atualize os testes existentes se suas mudanças os afetarem
    - Inclua tanto testes unitários quanto de integração quando apropriado

4. **Diretrizes de Commit**

    - Escreva mensagens de commit claras e descritivas
    - Referencie issues relevantes nos commits usando #número-da-issue

5. **Antes de Enviar**

    - Faça rebase da sua branch na última main
    - Certifique-se de que sua branch é construída com sucesso
    - Verifique novamente se todos os testes estão passando
    - Revise suas mudanças para qualquer código de depuração ou logs de console

6. **Descrição do Pull Request**
    - Descreva claramente o que suas mudanças fazem
    - Inclua passos para testar as mudanças
    - Liste quaisquer mudanças significativas
    - Adicione capturas de tela para mudanças na UI

## Acordo de Contribuição

Ao enviar um pull request, você concorda que suas contribuições serão licenciadas sob a mesma licença do projeto ([Apache 2.0](../LICENSE)).
