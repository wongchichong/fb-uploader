# Chalkee 🎨

A **lightweight**, **optimized**, and **chainable** terminal styling library for Node.js. Style your console output with colors, backgrounds, and text modifiers using a clean, fluent API.

## Features

✨ **Chainable API** - Combine colors, backgrounds, and modifiers seamlessly  
🎯 **Tree-shakeable** - Only bundle what you use (optimized module separation)  
⚡ **Highly Optimized** - 9 caching layers for maximum performance  
🎨 **256-Color Support** - Full hex and RGB color support  
📦 **Minimal Size** - Incredibly compact bundle (~42.60 KB core)  
🔄 **Template Literal Support** - Use backticks for styling  
🌈 **Auto-spacing** - Automatic spacing between styled segments  
🔌 **Background Mode** - Special mode for consistent background color changes  

## Installation

```bash
npm install chalkee
# or
pnpm add chalkee
# or
yarn add chalkee
```

## Quick Start

```typescript
import chalkee, { red, blue, bold, bgGreen } from 'chalkee'

// Basic colors
console.log(red`Hello World`)
console.log(blue`Styled text`)

// Chaining modifiers
console.log(bold.underline`Bold and underlined`)

// Combining foreground and background
console.log(red.bgGreen`Red text on green background`)

// Template literals
console.log(red`Error: ${errorCode}`)

// Auto-spacing
console.log(red`Error:`.as.blue`File not found`)

// Hex colors
console.log(chalkee.hex('#ff0000')`Red text`)

// RGB colors
console.log(chalkee.rgb(255, 0, 0)`Red text`)
```

## API Reference

### Colors

#### Foreground Colors
`red`, `green`, `blue`, `yellow`, `magenta`, `cyan`, `white`, `black`, `gray`, `grey`

#### Bright Colors
`redBright`, `greenBright`, `blueBright`, `yellowBright`, `magentaBright`, `cyanBright`, `whiteBright`, `blackBright`

#### Background Colors
`bgRed`, `bgGreen`, `bgBlue`, `bgYellow`, `bgMagenta`, `bgCyan`, `bgWhite`, `bgBlack`

#### Bright Background Colors
`bgRedBright`, `bgGreenBright`, `bgBlueBright`, `bgYellowBright`, `bgMagentaBright`, `bgCyanBright`, `bgWhiteBright`, `bgBlackBright`

### Modifiers

- `bold` / `b` - Bold text
- `dim` / `d` - Dim/faint text
- `italic` / `i` - Italic text
- `underline` / `u` - Underlined text
- `strikethrough` / `s` - Strikethrough text
- `inverse` - Inverted colors
- `hidden` - Hidden text
- `reset` / `r` - Reset all styles

### Custom Colors

#### Hex Colors
```typescript
chalkee.hex('#ff0000')`Red text`
chalkee.hex('#f00')`Short hex also works`
chalkee.bgHex('#00ff00')`Green background`
```

#### RGB Colors
```typescript
chalkee.rgb(255, 0, 0)`Red text`
chalkee.bgRgb(0, 255, 0)`Green background`
```

### Special Features

#### Auto-spacing
Add automatic spacing between styled elements. This works with template literals, function calls, and operators:
```typescript
const a = 2, b = 4;

// Simple usage
red`Error:`.as.blue`File not found`
// Output: "Error: File not found"

// Complex chaining with expressions and operators
red`first`.as(a)`+`.blue`second`(b)`=`.green(a + b)
// Output: "first 2 + second 4 = 6" (all with red color, some with blue)
```

#### Chainable Spacing & Variable Injection
You can eliminate `${}` in template literals by chaining calls. Use `(b)` instead of `${b}` for cleaner injection:
```typescript
const a = 1, b = 2;
// Clean chaining: less typing, eliminates ${}
red`Result:`.as(a)`+`(b)`=`.green(a + b)
// result: Result: 1 + 2 = 3

// Standard way: more typing, verbose ${}
red`Result:`.as(`${a}+${b}=`).green`${a + b}` // Seems longer/tedious
```

#### Reset & Fresh Starts
Use `.r` or `.reset` to clear all styles in the middle of a chain and start fresh:
```typescript
// Clear styles and apply new ones
red.bold.underline('styled').r.green.italic('after reset')

// Using shorthand with template literals
blue.dim`blue dim text`.r.yellow.bold`yellow bold text`
```

#### Shorthand Aliases
Save characters with compact aliases:
```typescript
import { b, d, i, u, s, r } from 'chalkee'

b`bold`         // bold
d`dim`          // dim
i`italic`       // italic
u`underline`    // underline
s`strikethrough` // strikethrough
r`reset`        // reset (clears style)
```

#### Background Mode
Change background colors while keeping consistent text:
```typescript
chalkee.bg.red`First`.blue`Second`.green`Third`
// All text is white (default), but backgrounds change
```

#### Smart Output
Styled results are not just strings, but callable objects that behave intelligently:
- **String conversion:** `result.toString()` or `"" + result` returns the ANSI-encoded string.
- **Node.js Integration:** Support for `util.inspect.custom` means `console.log(result)` shows the styled text directly in the terminal.
- **Value access:** `result.valueOf()` returns the ANSI-encoded string.

#### Complex Combinations
```typescript
// Colors and modifiers accumulate in a chain
red`red`.bgBlue`bg blue`.bold`bold`
// Output: red text, then red on blue background, then red on blue background and bold
```

#### Template Literals
Use backticks for readable styling:
```typescript
const name = 'Alice'
red`Hello ${name}`
// or
red`Hello`(name)
```

## Usage Examples

### Simple Styling
```typescript
import { red, green, bold } from 'chalkee'

console.log(red`Error: Something went wrong`)
console.log(green`Success: Operation completed`)
console.log(bold`Important message`)
```

### Complex Combinations
```typescript
import chalkee from 'chalkee'

const success = bold.green`✓ Success`
const error = bold.red`✗ Error`
const warning = bold.yellow`⚠ Warning`

console.log(success)
console.log(error)
console.log(warning)
```

### Custom Colors
```typescript
import chalkee from 'chalkee'

// Hex color
console.log(chalkee.hex('#7c3aed')`Purple text`)

// RGB color
console.log(chalkee.rgb(124, 58, 237)`Also purple`)

// Background colors
console.log(chalkee.bgHex('#3b82f6')`Blue background`)
```

### Conditional Styling
```typescript
import { red, green } from 'chalkee'

const status = (success: boolean, message: string) => {
  return success ? green(message) : red(message)
}

console.log(status(true, 'All tests passed'))
console.log(status(false, 'Tests failed'))
```

## Performance

Chalkee is highly optimized with multiple caching layers:

1. **ANSI Code Caching** - Pre-computed escape sequences
2. **Color Definition Caching** - Color lookups cached
3. **Property Descriptor Caching** - Prototype methods cached
4. **State Merging Optimization** - Structural sharing for style states
5. **Runtime Color Control** - Dynamic noColor flag for instant color toggle
6. **Auto-spacing State Caching** - Space state optimization
7. **Modifier Lookup Caching** - Fast modifier code access
8. **256-Color Mapping** - Pre-mapped RGB to ANSI conversions
9. **Instance Pooling** - Efficient function object reuse

### Bundle Sizes

| Format | Size (gzipped) |
|--------|---|
| ES Module | ~7.17 KB |
| CommonJS | ~6.47 KB |
| Core (all formats) | ~42.60 KB total |

## Architecture

Chalkee uses a modular, tree-shakeable architecture:

- **ChalkeeBase** - Base class with core methods
- **styler** - ANSI code generation engine
- **registry** - Color and modifier definitions
- **utils** - Instance creation utilities
- **callable-helpers** - Property descriptors for methods
- **Chalkee** - Main callable factory
- **modifiers** - Modifier method attachment
- **ansi-colors** - Color export wrapper

## Environment Variables & Runtime Control

### Runtime Color Toggle
Control colors **at runtime** using any chainable function's `noColor` property:
```typescript
import { red } from 'chalkee'

const message = red`Error message`
console.log(message)  // Shows styled output with ANSI codes

// Disable colors at runtime
red.noColor = true
console.log(message)  // Shows plain text without ANSI codes

// Re-enable colors
red.noColor = false
console.log(message)  // Shows styled output again
```

**Note:** The `noColor` flag is a static property shared across all styled functions. Setting it on any function (e.g., `red.noColor`, `bold.noColor`, `bg.noColor`) affects color output globally. Existing styled text objects will reflect the current `noColor` state when converted to string.

### Environment Variables

**Legacy:** Environment variables (NO_COLOR, FORCE_COLOR) can still be used but must be set **before** the module is imported. For runtime control, use `ChalkeeBase.noColor` instead.

**Note:** Environment variables must be set **before** the module is imported, as they are cached at module load time.

## Browser Compatibility

Chalkee is designed for **Node.js only**. It won't work in browsers because:
- Uses Node.js `util` module for inspect customization
- Relies on terminal ANSI escape codes
- Terminal environment assumptions

## Comparison

| Feature | Chalkee | chalk | ansi-colors |
|---------|---------|-------|------------|
| Chainable | ✅ | ✅ | ❌ |
| Hex Colors | ✅ | ✅ | ❌ |
| RGB Colors | ✅ | ✅ | ❌ |
| Tree-shakeable | ✅ | ❌ | ✅ |
| Auto-spacing | ✅ | ❌ | ❌ |
| Bundle Size | 42.60 KB | ~40 KB | ~15 KB |
| Caching | 9 layers | Minimal | Minimal |

## Testing

Run tests:
```bash
pnpm test
```

Run tests in watch mode:
```bash
pnpm test:watch
```

Tests cover:
- Basic color and modifier application
- Chaining and combinations
- Template literal usage
- Hex and RGB colors
- Background colors
- Auto-spacing functionality
- Reset and complex styling
- Edge cases

## Development

### Build
```bash
pnpm build
```

### Build (minified)
```bash
pnpm build:min
```

### Watch mode
```bash
pnpm dev
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues, questions, or suggestions, please open an issue on the GitHub repository.

---

Made with ❤️ for terminal enthusiasts
