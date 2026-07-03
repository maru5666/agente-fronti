# Sistema de Skills de Fronti

Fronti usa Skills modulares para decidir qué capacidad ejecutar según el contexto de la conversación.

## Contrato

Cada Skill implementa `FrontiSkill`:

- `name`: identificador estable en español o snake_case.
- `description`: qué resuelve.
- `priority`: prioridad de selección.
- `canHandle(context)`: decide si la Skill aplica.
- `execute(context)`: ejecuta la acción y devuelve una respuesta natural.

## Flujo

1. `/fronti/chat` normaliza el mensaje.
2. `IntentRouterService` clasifica intención general.
3. `ToolRouterService` mantiene compatibilidad con herramientas del agente.
4. `SkillsRegistryService` evalúa Skills por prioridad.
5. La primera Skill aplicable responde.
6. `CriticAgentService` revisa claridad, tono y seguridad.
7. `AgentLogsService` guarda intención, herramienta, Skill, resultado y respuesta final.

## Agregar una Skill

1. Crear carpeta en `src/fronti/skills/nueva-skill`.
2. Crear `nueva-skill.skill.ts`.
3. Implementar `FrontiSkill`.
4. Agregar `README.md` y `*.spec.ts`.
5. Registrar el provider en `fronti.module.ts` y en `SkillsRegistryService`.

El núcleo conversacional no necesita reglas nuevas si la Skill encapsula su detección y ejecución.

## Multiempresa y Sucursales

Todas las Skills reciben `companyId` y `senderPhone` dentro de `SkillContext`.

El modelo `CompanyBranch` permite evolucionar a múltiples sucursales por empresa sin mezclar catálogos, direcciones ni delivery.
