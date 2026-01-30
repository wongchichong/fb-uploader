// Test file for isEnabled regex logic
const testSnapshot1 = 'button "Post" [ref=e10] [disabled]';  // Disabled button
const testSnapshot2 = 'button "Post" [ref=e10]';             // Enabled button
const elementRef = 'e10';

// Test the regex pattern
const disabledRegex = new RegExp(`button "Post"\\s+\\[ref=${elementRef}\\]\\s+\\[disabled\\]`);
console.log('Pattern:', disabledRegex);
console.log('Test 1 (disabled):', disabledRegex.test(testSnapshot1));  // Should be true
console.log('Test 2 (enabled):', disabledRegex.test(testSnapshot2));   // Should be false

// The logic should return:
// - false when disabledRegex.test() is true (button is disabled)
// - true when disabledRegex.test() is false (button is enabled)
console.log('isEnabled for Test 1 (disabled button):', !disabledRegex.test(testSnapshot1)); // Should be false
console.log('isEnabled for Test 2 (enabled button):', !disabledRegex.test(testSnapshot2));  // Should be true