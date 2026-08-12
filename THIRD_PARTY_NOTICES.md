# Third-Party Notices

OpenCode HHC Orchestrator (OHO) özgün bir Apache-2.0 uygulamasıdır. Üçüncü taraf runtime kodu veya ayrı orchestration plugin'i ürün içine vendor edilmez.

## Doğrudan build/runtime bağımlılıkları

| Paket | İlişki | Lisans | Kullanım |
|---|---|---|---|
| `@opencode-ai/plugin` | host peer dependency | MIT | OpenCode native plugin API/types/runtime contract |
| `typescript` | development dependency | Apache-2.0 | TypeScript build/compiler toolchain |

## Methodology research / adapted concepts

Aşağıdaki kaynaklar yeni HHC-native methodology skill'lerin tasarımında incelenmiş ve kavramları HHC control-plane sınırlarına göre yeniden yazılmıştır. OHO bu projeleri runtime dependency veya ayrı plugin olarak gerektirmez.

| Kaynak | Lisans | Kullanım |
|---|---|---|
| `opencode-agent-orchestration-kit` | Apache-2.0 | source-driven development, API/interface design, ADR, iterative retrieval, TDD, adversarial validation ve ilgili methodology araştırması |
| `obra/superpowers` | MIT | review-feedback, design discovery, worktree isolation, skill-authoring ve TDD methodology araştırması |

Bu kaynaklardan alınan fikirler HHC-native, bounded, default-zero skill sözleşmelerine uyarlanmıştır; task/model/worker/continuation/STOP ownership HHC runtime'da kalır.
