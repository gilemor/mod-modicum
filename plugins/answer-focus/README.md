# answer-focus

Hace que la respuesta de Claude resalte sobre el resto del turno.

- **Pasos intermedios atenuados.** Lo que Claude escribe antes de usar herramientas ("Miro el código…", "Ahora los estilos…") se ve atenuado, así la respuesta final destaca al hacer scroll.
- **Lo que te toca, resaltado.** Cuando una respuesta te pide hacer o decidir algo, Claude lo apunta en un bloque `<te-toca>` al final, una acción por línea y escrita para entenderse sola. La mod oculta el bloque y muestra cada línea bajo la respuesta, con una flecha y resaltada. Claude recibe la instrucción una vez por sesión (y otra tras compactar), así que cuesta pocos tokens.

Atenuar los pasos solo cambia cómo se dibujan. El bloque `<te-toca>` sí queda en la conversación, aunque no lo veas. En sesiones reanudadas, los turnos de antes de cargar la mod se ven como siempre.

## Instalación

En una sesión de Claude Code en terminal, escribe:

```
/plugin install answer-focus --marketplace gilemor/mod-modicum
```

Abre una sesión nueva para que cargue.

## Opciones

Se cambian desde el menú de configuración de plugins o desde la terminal:

```bash
echo '{"highlightColor": "verde"}' | claude plugin configure answer-focus@mod-modicum --values-stdin
```

| Opción | Qué controla |
| --- | --- |
| Atenuar pasos intermedios (`dimSteps`) | El texto entre herramientas atenuado. |
| Lo que te toca (`actionCard`) | Las acciones resaltadas bajo cada respuesta. |
| Color del resaltado (`highlightColor`) | `ámbar` (por defecto), `amarillo`, `verde`, `azul`, `violeta` o `rosa`. |
