import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import * as util from 'util'
import chalkee, {
    red, green, blue, yellow, magenta, cyan, white, black, gray, grey,
    redBright, greenBright, blueBright, yellowBright, magentaBright, cyanBright, whiteBright, blackBright,
    bold, dim, italic, underline, strikethrough, inverse, hidden,
    bgRed, bgGreen, bgBlue, bgYellow, bgMagenta, bgCyan, bgWhite, bgBlack,
    bgRedBright, bgGreenBright, bgBlueBright, bgYellowBright, bgMagentaBright, bgCyanBright, bgWhiteBright, bgBlackBright,
    b, d, i, u, s, r,
    reset, as, hex, rgb, bgHex, bgRgb, bg
} from 'chalkee'

// Test the core functionality
test('Chalkee - should create basic styled strings with proper custom inspect', () => {
    const redText = red`Hello World`

    // Test that it's a function
    assert.equal(typeof redText, 'function')

    // Test custom inspect functionality
    console.log('Red text (should show styled text):', redText)
    console.log(red('Hello World'), 'Red text 2 (should show styled text):')

    // Test toString method
    console.log('Red text toString():', JSON.stringify(redText.toString()))
    assert.match(redText.toString(), /\x1b\[31mHello World\x1b\[0m/)
    assert.equal(redText.toString(), '\u001b[31mHello World\u001b[0m', 'Should have exact red ANSI escape codes')

    // Test that custom inspect symbol works
    const customSymbol = util.inspect.custom
    assert.ok(redText[customSymbol], 'Should have custom inspect symbol')
    assert.equal(redText[customSymbol](), redText.toString(), 'Custom inspect should return same as toString')
})

test('Chalkee - should support bright color exports', () => {
    const result = redBright`Hello World`
    console.log('Individual redBright export:', result)
    assert.equal(typeof result, 'function')
    assert.equal(result.toString(), '\u001b[91mHello World\u001b[0m', 'Should have exact redBright ANSI escape codes')
})

test('Chalkee - should support individual color exports', () => {
    const result = red`Hello World`
    console.log('Individual red export:', result)
    assert.equal(result.toString(), '\u001b[31mHello World\u001b[0m', 'Should have exact red ANSI escape codes')
})

test('Chalkee - should support individual style exports', () => {
    const result = bold`Hello World`
    console.log('Individual bold export:', result)
    assert.equal(result.toString(), '\u001b[1mHello World\u001b[0m', 'Should have exact bold ANSI escape codes')
})

test('Chalkee - should support complex color combinations using individual exports', () => {
    // Test multiple modifiers using individual exports
    const redText = red`red text`
    const boldText = bold`bold text`
    const result = underline`underline text`
    console.log('Multiple modifiers with individual exports:', result)
    assert.equal(result.toString(), '\u001b[4munderline text\u001b[0m', 'Should have exact underline ANSI escape codes')
})

test('Chalkee - should support complex combinations with foreground and background colors', () => {
    // Test mixing foreground and background colors
    // From README: red`Error:`.bgBlue`File not found`
    const result = red`red text`.bgBlue`bg blue text`
    console.log('Mixed fg/bg colors:', result)
    // Note: Color accumulates - red carries forward with bgBlue
    assert.equal(result.toString(), '\u001b[31mred text\u001b[0m\u001b[31;44mbg blue text\u001b[0m', 'Should concatenate red text with bgBlue text (color accumulates)')
})

test('Chalkee - should support complex combinations with bright colors', () => {
    const result = redBright`bright red text`.bold`bold text`
    console.log('Complex combination with bright colors:', result)
    // Note: Bright red carries forward with bold
    assert.equal(result.toString(), '\u001b[91mbright red text\u001b[0m\u001b[1;91mbold text\u001b[0m', 'Should concatenate redBright with bold (color accumulates)')
})

test('Chalkee - should support shorthand aliases using individual exports', () => {
    // Test shorthand aliases using individual exports
    const boldResult = b`Bold text`
    const dimResult = d`Dim text`
    const underlineResult = u`Underline text`

    console.log('Shorthand aliases with individual exports:')
    console.log('  bold:', boldResult)
    console.log('  dim:', dimResult)
    console.log('  underline:', underlineResult)

    assert.equal(boldResult.toString(), '\u001b[1mBold text\u001b[0m', 'Should have exact bold ANSI codes')
    assert.equal(dimResult.toString(), '\u001b[2mDim text\u001b[0m', 'Should have exact dim ANSI codes')
    assert.equal(underlineResult.toString(), '\u001b[4mUnderline text\u001b[0m', 'Should have exact underline ANSI codes')
})

test('Chalkee - should support reset functionality', () => {
    // Test full reset functionality with escape code comparison
    const result = red`red text`
    const resetResult = reset`unstyled text`
    console.log('Reset functionality:', result)
    // After reset, the text should be unstyled (no color codes)
    assert.equal(result.toString(), '\u001b[31mred text\u001b[0m', 'Should have exact red ANSI escape codes')
    assert.equal(resetResult.toString(), 'unstyled text\u001b[0m', 'Should have correct ANSI escape codes with reset clearing styles')

    // Test shorthand reset with escape code comparison
    const result2 = red`red text`
    const rResult = r`reset text`
    console.log('Shorthand reset:', result2)
    // After shorthand reset, the text should be unstyled (no color codes)
    assert.equal(rResult.toString(), 'reset text\u001b[0m', 'Should have correct ANSI escape codes with shorthand reset clearing styles')
})

test('Chalkee - should convert to string with ANSI codes', () => {
    const result = red`Hello World`.toString()
    // Should contain exact ANSI escape codes
    assert.equal(result, '\u001b[31mHello World\u001b[0m', 'Should have exact ANSI escape codes')
    console.log('ANSI codes present:', JSON.stringify(result))
})

test('Chalkee - should produce different outputs for different colors', () => {
    const redResult = red`Hello`.toString()
    const blueResult = blue`Hello`.toString()

    // Both should contain exact ANSI codes and be different
    assert.equal(redResult, '\u001b[31mHello\u001b[0m', 'Red result should have exact red ANSI codes')
    assert.equal(blueResult, '\u001b[34mHello\u001b[0m', 'Blue result should have exact blue ANSI codes')
    assert.notEqual(redResult, blueResult, 'Red and blue results should be different')

    console.log('Red result:', JSON.stringify(redResult))
    console.log('Blue result:', JSON.stringify(blueResult))
})

// Test edge cases
test('Chalkee - should handle empty strings', () => {
    const result = red``
    console.log('Empty string result:', result)
    assert.equal(result.toString(), '\u001b[31m\u001b[0m', 'Should handle empty strings with ANSI codes')
})

test('Chalkee - should support background color exports', () => {
    const result = bgRed`Hello World`
    console.log('Individual bgRed export:', result)
    console.log('bgRed actual output:', JSON.stringify(result.toString()))
    assert.equal(result.toString(), '\u001b[41mHello World\u001b[0m', 'Should have exact bgRed ANSI escape codes')
})

test('Chalkee - should support complex combinations with background colors', () => {
    const result = bgBlue`bg text`
    console.log('Complex combination with background colors:', result)
    assert.equal(result.toString(), '\u001b[44mbg text\u001b[0m', 'Should have exact bgBlue ANSI escape codes')
})

test('Chalkee - should support bright background color exports and noColor test', () => {
    const result = bgRedBright`Hello World`
    red.noColor = true
    console.log('Individual bgRedBright export (no color):', result)
    assert.equal(result.toString(), 'Hello World', 'Should have no ANSI codes when noColor is true')

    red.noColor = false
    console.log('Individual bgRedBright export:', result)

    assert.equal(result.toString(), '\u001b[101mHello World\u001b[0m', 'Should have exact bgRedBright ANSI escape codes')
})

test('Chalkee - should support background color function availability', () => {
    // Test that all background color functions are available and callable
    assert.equal(typeof bgRed, 'function')
    assert.equal(typeof bgBlue, 'function')
    assert.equal(typeof bgGreen, 'function')
    assert.equal(typeof bgYellow, 'function')
    assert.equal(typeof bgMagenta, 'function')
    assert.equal(typeof bgCyan, 'function')
    assert.equal(typeof bgWhite, 'function')
    assert.equal(typeof bgBlack, 'function')

    // Test that bright background color functions are available and callable
    assert.equal(typeof bgRedBright, 'function')
    assert.equal(typeof bgBlueBright, 'function')
    assert.equal(typeof bgGreenBright, 'function')
    assert.equal(typeof bgYellowBright, 'function')
    assert.equal(typeof bgMagentaBright, 'function')
    assert.equal(typeof bgCyanBright, 'function')
    assert.equal(typeof bgWhiteBright, 'function')
    assert.equal(typeof bgBlackBright, 'function')
})

test('Chalkee - should support hex color functionality', () => {
    const hexInstance = hex('#ff0000')
    const result = hexInstance`red hex text`
    console.log('Hex color functionality:', result)
    assert.equal(typeof result, 'function')
    assert.equal(result.toString(), '\u001b[38;5;196mred hex text\u001b[0m', 'Should have exact hex color ANSI escape codes')

    // Test 3-digit hex
    const hexInstance2 = hex('#f00')
    const result2 = hexInstance2`short hex text`
    console.log('Short hex color:', result2)
    assert.equal(typeof result2, 'function')
    assert.equal(result2.toString(), '\u001b[38;5;196mshort hex text\u001b[0m', 'Should convert 3-digit hex to 256-color ANSI codes')
})

test('Chalkee - should support rgb color functionality', () => {
    const rgbInstance = rgb(255, 0, 0)
    const result = rgbInstance`red rgb text`
    console.log('RGB color functionality:', result)
    assert.equal(typeof result, 'function')
    assert.equal(result.toString(), '\u001b[38;5;196mred rgb text\u001b[0m', 'Should have exact RGB color ANSI escape codes')
})

test('Chalkee - should support background hex color functionality', () => {
    const bgHexInstance = bgHex('#00ff00')
    const result = bgHexInstance`green background`
    console.log('Background hex color:', result)
    assert.equal(typeof result, 'function')
    // Hex colors have reset code after color code
    assert.equal(result.toString(), '\u001b[48;5;46mgreen background\u001b[0m', 'Should have exact background hex color ANSI escape codes')
})

test('Chalkee - should support background rgb color functionality', () => {
    const bgRgbInstance = bgRgb(0, 255, 0)
    const result = bgRgbInstance`green background`
    console.log('Background RGB color:', result)
    assert.equal(typeof result, 'function')
    // Background RGB colors have reset code after color code
    assert.equal(result.toString(), '\u001b[48;5;46mgreen background\u001b[0m', 'Should have exact background RGB color ANSI escape codes')
})

test('Chalkee - should support auto-spacing functionality', () => {
    const a = 2
    const b = 4
    const result = red`first`.as(a)`+`.blue`second`(b)`=`.green(a + b)
    console.log('Auto-spacing functionality:', result)
    // Note: Chaining accumulates colors - red carries forward
    assert.equal(result.toString(), '\u001b[31mfirst\u001b[0m \u001b[31m2\u001b[0m \u001b[31m+\u001b[0m \u001b[31;34msecond\u001b[0m \u001b[31;34m4\u001b[0m \u001b[31;34m=\u001b[0m \u001b[31;34;32m6\u001b[0m', 'Should add spaces and carry forward colors in complex chain with operators')
})

test('Chalkee - should support complex chaining with auto-spacing', () => {
    // Test chaining with auto-spacing in the middle of a chain
    const result = red`first`.as.green`second`
    console.log('Complex chaining with auto-spacing:', result)
    // Note: Chaining accumulates colors - red carries forward then green is added
    assert.equal(result.toString(), '\u001b[31mfirst\u001b[0m \u001b[31;32msecond\u001b[0m', 'Should add space and accumulate colors')

    // Test chaining with multiple auto-spacing
    const result2 = blue`start`.as.yellow`next`.as.cyan`then`.as.magenta`end`
    console.log('Multiple auto-spacing:', result2)
    // Colors accumulate: blue → blue+yellow → blue+yellow+cyan → blue+yellow+cyan+magenta
    assert.equal(result2.toString(), '\u001b[34mstart\u001b[0m \u001b[34;33mnext\u001b[0m \u001b[34;33;36mthen\u001b[0m \u001b[34;33;36;35mend\u001b[0m', 'Should add spaces and accumulate colors')
})

test('Chalkee - should support complex chaining with background colors and auto-spacing', () => {
    // Test chaining with background colors and auto-spacing
    const result = bgRed`bg first`.as.bgGreen`bg second`
    console.log('Complex chaining with bg colors and auto-spacing:', result)
    // Note: Background colors accumulate - bgRed carries forward
    assert.equal(result.toString(), '\u001b[41mbg first\u001b[0m \u001b[41;42mbg second\u001b[0m', 'Should add space and accumulate background colors')

    // Test chaining with multiple background colors and auto-spacing
    const result2 = bgBlue`bg start`.as.bgYellow`bg next`.as.bgCyan`bg then`.as.bgMagenta`bg end`
    console.log('Multiple bg colors with auto-spacing:', result2)
    // Background colors accumulate
    assert.equal(result2.toString(), '\u001b[44mbg start\u001b[0m \u001b[44;43mbg next\u001b[0m \u001b[44;43;46mbg then\u001b[0m \u001b[44;43;46;45mbg end\u001b[0m', 'Should add spaces and accumulate background colors')
})

test('Chalkee - should support complex chaining with reset', () => {
    // Test chaining with reset in the middle of a chain
    // The reset (.r) clears styles and starts fresh
    const result = red.bold.underline('styled').r.green.italic('after reset')
    console.log('Complex chaining with reset:', result)
    assert.equal(typeof result, 'function')
    // Should have red+bold+underline, then reset, then green+italic
    // Note: actual output order is modifiers then colors
    assert.equal(result.toString(), '\x1B[1;4;31mstyled\x1B[0m\x1B[3;32mafter reset\x1B[0m', 'Should apply styles before reset, clear on reset, apply new styles after')

    // Test chaining with shorthand reset using template literals
    const result2 = blue.dim`blue dim text`.r.yellow.bold`yellow bold text`
    console.log('Chaining with shorthand reset:', result2)
    assert.equal(typeof result2, 'function')
    // Should have blue+dim, then reset (no text), then yellow+bold
    assert.equal(result2.toString(), '\x1B[2;34mblue dim text\x1B[0m\x1B[1;33myellow bold text\x1B[0m', 'Should properly reset and apply new styles')
})

test('Chalkee - should support complex chaining with mixed styles including background colors', () => {
    // Test complex chaining with multiple styles: background colors, underline, italic, bold, strikethrough
    const result = bgRed`bg red`.u`underlined`.i`italic`.b`bold`.s`strikethrough`
    console.log('Complex mixed styling chain:', result)
    // Styles accumulate: bgRed → bgRed+underline → bgRed+underline+italic → etc.
    assert.equal(result.toString(), '\x1B[41mbg red\x1B[0m\x1B[4;41munderlined\x1B[0m\x1B[4;3;41mitalic\x1B[0m\x1B[4;3;1;41mbold\x1B[0m\x1B[4;3;1;9;41mstrikethrough\x1B[0m', 'Should concatenate all chained styles and accumulate')

    // Test with auto-spacing
    const result2 = bgBlue`bg blue`.as.u`underlined`.i`italic`.b`bold`.s`strikethrough`
    console.log('Complex mixed styling chain with auto-spacing:', result2)
    assert.equal(typeof result2, 'function')
})

test('Chalkee - should support background mode chaining with .bg operator', () => {
    // Test background mode chaining: bg.red``.blue`` -> bg allows changing colors
    // User expectation: .bg.red`red bg`.blue`blue bg` -> 'red bg blue bg' (all text white, backgrounds change)
    // From README: bg.red`First`.blue`Second`.green`Third`
    const result = bg.red`red background`.blue`blue background`
    console.log('Background mode chaining:', result)
    // Should have red background then blue background (all with white text)
    assert.equal(result.toString(), '\x1B[41mred background\x1B[0m\x1B[44mblue background\x1B[0m', 'Should apply foreground colors as background colors with .bg operator')

    // Test background mode with auto-spacing
    const result2 = as.bg.red`red background`.blue`blue background`
    console.log('Background mode with auto-spacing:', result2)
    // Should have red background then blue background with auto-spacing
    // The space should not have any styling per user requirement
    assert.equal(result2.toString(), '\x1B[41mred background\x1B[0m \x1B[44mblue background\x1B[0m', 'Should apply foreground colors as background colors with .as.bg operator and auto-spacing')
})