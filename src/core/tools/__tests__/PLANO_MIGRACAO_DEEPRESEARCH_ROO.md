# Estratégia de Migração e Reengenharia das Ferramentas DeepResearch para o Padrão Roo

## Contexto

Este plano detalha a migração e reimplementação das ferramentas, utilitários e serviços do projeto node-DeepResearch-nexcode para o padrão Roo, garantindo:

- Modularidade, testabilidade e integração Roo-first.
- Uso de schemas Roo (ex: Zod) para tipagem.
- Configuração centralizada Roo.
- Logging e métricas via logger Roo.
- Evitar qualquer dependência herdada desnecessária.

---

## Estrutura Recomendada

```
src/
  core/
    tools/
      toolsDeepResearch/
        [cada ferramenta Roo-first]
        index.ts
        __tests__/
    utils/
      [apenas utilitários realmente necessários e não duplicados]
      __tests__/
    config/
      config.ts
```

---

## Tarefas Necessárias

### 1. Ferramentas (toolsDeepResearch)

- [ ] Para cada arquivo em `tools/`, criar um módulo Roo-first:
    - [x] broken-ch-fixer
    - [x] code-sandbox
    - [x] dedup
    - [x] error-analyzer
    - [x] evaluator
    - [ ] grounding
    - [ ] jina-classify-spam
    - [ ] jina-dedup
    - [ ] jina-latechunk
    - [ ] jina-rerank
    - [ ] jina-search
    - [ ] md-fixer
    - [ ] query-rewriter
    - [ ] read
    - [ ] serper-search
- [ ] Para cada ferramenta:
    - [ ] Definir schemas Roo de entrada/saída (ex: Zod)
    - [ ] Integrar logger Roo para logs e métricas
    - [ ] Usar config Roo para variáveis sensíveis
    - [ ] Escrever testes Roo-first

### 2. Utilitários (utils)

- [ ] Migrar/adaptar apenas o que for realmente necessário e não duplicado:
    - [ ] action-tracker.ts
    - [ ] date-tools.ts
    - [ ] safe-generator.ts
    - [ ] schemas.ts (reescrever no padrão Roo)
    - [ ] text-tools.ts
    - [ ] url-tools.ts
- [ ] Não migrar token-tracker.ts (usar logger Roo)
- [ ] Integrar i18n apenas se Roo não tiver solução própria

### 3. Configuração

- [ ] Reescrever config.ts para o padrão Roo em `src/core/config/config.ts`
- [ ] Centralizar variáveis de ambiente e configs Roo

### 4. Serviços/Controllers

- [ ] Criar serviço/controller Roo para orquestração de fluxos complexos (ex: deepresearch)
- [ ] Garantir desacoplamento do agente antigo

### 5. Testes

- [ ] Reescrever todos os testes no padrão Roo/Jest
- [ ] Cobrir casos unitários e integração

### 6. Documentação

- [ ] Documentar cada módulo, utilitário e serviço Roo
- [ ] Incluir exemplos de uso e integração

---

**Observação:**
Se desejar, posso gerar exemplos de esqueleto de código Roo para uma ferramenta, um utilitário e a config, prontos para implementação incremental.

O erro persiste e está relacionado ao ambiente/editor ("Failed to open diff editor, please try again..."), não ao conteúdo ou à formatação. Isso indica uma limitação temporária do VSCode ou da extensão, impedindo operações de escrita/edição no momento.

Como alternativas:

- O conteúdo a ser adicionado está pronto e validado.
- O usuário pode colar manualmente o bloco sugerido ao final do arquivo, caso deseje agilidade.
- Posso aguardar a normalização do ambiente/editor para tentar novamente.

Segue abaixo o bloco pronto para ser adicionado ao final do arquivo PLANO_MIGRACAO_DEEPRESEARCH_ROO.md:

---

## Próximas Etapas Detalhadas

Com base no histórico de decisões e avanços já documentados, as próximas etapas para a migração Roo-first das ferramentas DeepResearch devem seguir o seguinte fluxo incremental e seguro:

### 1. Priorização e Planejamento

- Priorizar a migração das ferramentas menos acopladas e utilitários essenciais, conforme dependências identificadas.
- Validar se há ferramentas já parcialmente migradas além do `broken-ch-fixer` e atualizar o status no checklist.
- Revisar e evitar migração de código duplicado ou desnecessário, conforme destacado no histórico.

### 2. Migração Incremental de Ferramentas

Para cada ferramenta:

- [ ] Migrar para `src/core/tools/toolsDeepResearch/[tool].ts` seguindo o padrão Roo-first.
- [ ] Definir schemas Roo (Zod) para entrada/saída.
- [ ] Integrar logger Roo e centralizar configs sensíveis.
- [ ] Escrever testes unitários e de integração Roo/Jest.
- [ ] Documentar o módulo e exemplos de uso.
- [ ] Registrar no `toolsDeepResearch/index.ts`.
- [ ] Validar cobertura de testes e integração Roo.

### 3. Migração de Utilitários

- [ ] Migrar/adaptar apenas utilitários realmente necessários, evitando duplicidade.
- [ ] Reescrever schemas e helpers no padrão Roo.
- [ ] Garantir testes e documentação.

### 4. Configuração Centralizada

- [ ] Consolidar variáveis de ambiente e configs Roo em `src/core/config/config.ts`.
- [ ] Remover configs customizadas herdadas.

### 5. Serviços/Controllers

- [ ] Criar serviço/controller Roo para orquestração, desacoplando do agente antigo.
- [ ] Garantir integração Roo-first e testes.

### 6. Testes e Validação

- [ ] Reescrever todos os testes no padrão Roo/Jest.
- [ ] Garantir cobertura mínima e integração contínua.

### 7. Documentação e Exemplos

- [ ] Documentar cada módulo, utilitário e serviço Roo.
- [ ] Incluir exemplos práticos de uso e integração.

### 8. Remoção de Dependências Antigas

- [ ] Após validação, remover dependências, arquivos e integrações herdadas não utilizadas.

---

**Referências práticas e exemplos de skeleton Roo para cada etapa podem ser encontrados no histórico de atividades e nos arquivos já migrados.**

Se desejar, cole este bloco ao final do arquivo. Caso queira que eu tente novamente a edição automática, por favor, sinalize.
