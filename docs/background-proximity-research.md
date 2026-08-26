# Referências de proximidade em segundo plano

Esta nota registra as decisões técnicas para os lembretes de proximidade do appCasal. O recurso deve operar somente após consentimento explícito, sem registrar histórico de trajetos, e permitir pausa imediata.

## Síntese técnica

| Plataforma | Requisito relevante | Consequência para o appCasal |
|---|---|---|
| iOS | O monitoramento de regiões pode acordar o app quando a condição geográfica muda; o sistema limita o app a 20 condições monitoradas. | Priorizar até 20 lugares com lembretes ativos e recriar o monitor ao reabrir o app. |
| Android | Geofences exigem localização precisa e, em versões recentes, localização em segundo plano; há limite de 100 geofences por app. | Solicitar permissão em etapas, limitar a lista ativa e explicar a finalidade no app. |
| Expo / React Native | O suporte em segundo plano exige tarefa registrada no escopo superior, permissões próprias e uma compilação de desenvolvimento/produção no iOS. | A implementação precisa permanecer no aplicativo móvel, não no frontend web estático. |
| Google Play | Localização em segundo plano precisa ser essencial ao recurso, ter divulgação destacada, política de privacidade e declaração para revisão. | Documentar a finalidade de lembretes afetivos, evitar analytics e oferecer controles claros de ativação e pausa. |

## Decisão de produto

O app web continuará mostrando controles e preferências, mas a detecção com o aplicativo fechado será implementada no cliente móvel nativo. Os lembretes usam geofencing local e notificações locais, portanto nenhum trajeto ou evento de passagem precisa ser enviado ao banco. Somente as preferências do casal e os lugares escolhidos são sincronizados pelo Supabase.

## Fontes oficiais

1. [Expo Location — Background location e geofencing](https://docs.expo.dev/versions/latest/sdk/location/)
2. [Android Developers — Create and monitor geofences](https://developer.android.com/develop/sensors-and-location/location/geofencing)
3. [Apple Developer — Monitoring the user’s proximity to geographic regions](https://developer.apple.com/documentation/corelocation/monitoring-the-user-s-proximity-to-geographic-regions)
4. [Google Play Console — Localização nas permissões em segundo plano](https://support.google.com/googleplay/android-developer/answer/9799150?hl=pt-BR)
