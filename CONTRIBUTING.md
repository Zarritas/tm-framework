## 🌐 Idiomas / Languages

- 🇪🇸 **Español** (actual)
- 🇺🇸 [**English**](./CONTRIBUTING_EN.md)

# Contribuir a tm-framework

¡Gracias por tu interés en contribuir a tm-framework! Este documento proporciona directrices e información para los contribuidores.

## Cómo Contribuir

### Reportar Errores

- Usa el gestor de problemas de GitHub
- Proporciona información clara y detallada sobre el error
- Incluye los pasos para reproducir el problema
- Especifica los detalles de tu entorno (SO, versión de Node.js, etc.)

### Sugerir Funcionalidades

- Abre un issue con la etiqueta "enhancement"
- Proporciona una descripción clara de la funcionalidad propuesta
- Explica el caso de uso y los beneficios
- Considera si encaja en el alcance del proyecto

### Pull Requests

1. Haz un fork del repositorio
2. Crea una rama de funcionalidad: `git checkout -b feature/amazing-feature`
3. Confirma tus cambios: `git commit -m 'Añadir funcionalidad increíble'`
4. Envía a la rama: `git push origin feature/amazing-feature`
5. Abre un Pull Request

## Estilo de Código

- Sigue las convenciones de código existentes
- Escribe código limpio y legible
- Añade comentarios para lógica compleja
- Asegura el manejo adecuado de errores

### Convenciones de Nombrado

| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Clases | PascalCase | `FloatingButton` |
| Métodos | camelCase | `handleClick()` |
| Métodos privados | `_camelCase` | `_bindEvents()` |
| CSS clases | BEM con prefijo `tm-` | `.tm-btn--primary` |

### Eventos Emitidos (camelCase)

Todos los eventos emitidos via `this.emit()` deben usar **camelCase**:

```javascript
// Correcto
this.emit('click');
this.emit('itemClick');
this.emit('headerAction');

// Incorrecto
this.emit('item-click');    // kebab-case
```

### Props de Callback (on + PascalCase)

```javascript
static defaultProps = {
    onClick: null,        // Para evento 'click'
    onItemClick: null,    // Para evento 'itemClick'
};
```

### Propiedades de Estado

| Propósito | Nombre | Tipo |
|-----------|--------|------|
| Visibilidad | `visible` | `boolean` |
| Expansión | `expanded` | `boolean` |
| Selección | `selected` | `any` |
| Carga | `loading` | `boolean` |

### Logging

Usar `TM.Logger` para todos los logs:

```javascript
TM.Logger.debug('Module', 'Message', data);
TM.Logger.info('Module', 'Message', data);
TM.Logger.warn('Module', 'Message', data);
TM.Logger.error('Module', 'Message', data);
```

### JSDoc

Todos los métodos públicos deben tener JSDoc:

```javascript
/**
 * Descripción breve
 * @param {Type} nombre - Descripción
 * @returns {Type} Descripción
 */
```

## Pruebas

- Escribe pruebas para nuevas funcionalidades
- Asegúrate de que todas las pruebas pasen antes de enviar
- Incluye cobertura de pruebas para rutas críticas

## Mensajes de Commit

- Usa mensajes de commit claros y descriptivos
- Sigue el formato de commit convencional cuando sea posible
- Referencia los issues relacionados en tus commits

## Revisión de Código

- Todas las contribuciones requieren revisión
- Sé receptivo a las retroalimentaciones
- Ayuda a revisar los PRs de otros contribuidores

## Licencia

Al contribuir, aceptas que tus contribuciones serán licenciadas bajo la Licencia MIT.
