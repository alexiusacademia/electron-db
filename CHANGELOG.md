# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-01

### 🚀 Major Release - Modernization Update

This is a **major milestone** for electron-db! We've modernized the library while maintaining **100% backward compatibility**.

### Added
- **Promise/async-await support** - All functions now have `Async` variants that return Promises
- **TypeScript definitions** - Full TypeScript support with comprehensive type definitions
- **Promisify utility** - Convert any callback function to Promise-based
- **Modern examples** - Updated README with both callback and async/await examples
- **Demo script** - Interactive demo showcasing both APIs (`npm run demo`)
- **Comprehensive test suite** - Added 11 new tests for Promise-based API (45 total tests)

### Changed
- **Node.js requirement** - Now requires Node.js 14.0.0 or higher
- **Package description** - Updated to reflect modern capabilities
- **CI configuration** - Updated to test on Node.js 14, 16, 18, and 20
- **Documentation** - Completely refreshed README with modern examples
- **Version bump** - Major version bump to 1.0.0 to reflect maturity

### Enhanced
- **Error handling** - Improved error messages and consistent error objects
- **Path handling** - Better cross-platform path resolution
- **Code organization** - Cleaner exports with both legacy and modern APIs

### Backward Compatibility
- ✅ **All existing callback-based functions work unchanged**
- ✅ **All existing code will continue to work without modifications**
- ✅ **No breaking changes to the original API**

### New API Functions
All original functions now have Promise-based equivalents:

- `createTableAsync()`
- `insertTableContentAsync()`
- `insertTableContentsAsync()`
- `getAllAsync()`
- `getRowsAsync()`
- `updateRowAsync()`
- `searchAsync()`
- `deleteRowAsync()`
- `validAsync()`
- `clearTableAsync()`
- `getFieldAsync()`
- `countAsync()`
- `tableExistsAsync()`

### Migration Guide
```javascript
// Old (still works)
db.getAll('users', (err, data) => {
  if (err) console.error(err);
  else console.log(data);
});

// New (recommended)
try {
  const data = await db.getAllAsync('users');
  console.log(data);
} catch (err) {
  console.error(err);
}
```

### Technical Improvements
- Modern JavaScript practices
- Promise-based architecture
- TypeScript integration
- Enhanced testing
- Updated CI/CD pipeline
- Cross-platform compatibility

---

## [0.15.5] and earlier

See Git history for previous changes. Version 1.0.0 represents a major modernization milestone while maintaining full backward compatibility.