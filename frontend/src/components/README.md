# Global Loading Screen Component

## Overview
Reusable loading screen component with DB logo, spinner, and customizable message.

## Files
- `LoadingScreen.tsx` - The loading screen component
- `../hooks/useLoading.ts` - Custom hook for easy loading management

## Usage

### Method 1: Using the Hook (Recommended)

```typescript
import { useLoading } from '../hooks/useLoading';
import LoadingScreen from '../components/LoadingScreen';

function MyComponent() {
  const { isLoading, loadingMessage, withLoading, showLoading } = useLoading();

  // Example 1: Show loading for 2 seconds
  const handleClick = () => {
    showLoading(2, 'Processing...');
  };

  // Example 2: Wrap async function with minimum 3 seconds loading
  const handleLogin = async () => {
    await withLoading(async () => {
      const response = await api.post('/login', data);
      // ... handle response
    }, 3, 'Logging in...');
  };

  return (
    <div>
      {isLoading && <LoadingScreen message={loadingMessage} />}
      {/* Your content */}
    </div>
  );
}
```

### Method 2: Direct Component Usage

```typescript
import LoadingScreen from '../components/LoadingScreen';

function MyComponent() {
  const [loading, setLoading] = useState(false);

  return (
    <div>
      {loading && <LoadingScreen message="Please wait..." />}
      {/* Your content */}
    </div>
  );
}
```

## Hook API

### `useLoading(options?)`

Returns an object with:

#### `isLoading: boolean`

Current loading state

#### `loadingMessage: string`

Current loading message (automatically set by `withLoading`, `showLoading`, or `startLoading`)

#### `showLoading(duration, message?)`
Show loading for a specific duration
- `duration`: Duration in seconds (e.g., 2 for 2 seconds)
- `message`: Optional loading message

```typescript
showLoading(2, 'Saving...');
```

#### `withLoading(fn, minSeconds?, message?)`
Execute async function with minimum loading duration
- `fn`: Async function to execute
- `minSeconds`: Minimum duration in seconds (default: 0)
- `message`: Optional loading message

```typescript
await withLoading(async () => {
  await saveData();
}, 3, 'Saving data...');
```

#### `startLoading(message?)`

Manually start loading with optional message

```typescript
startLoading('Custom message...');
```

#### `stopLoading()`
Manually stop loading

## Component Props

### `LoadingScreen`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| message | string | 'Loading...' | Loading message to display |
| minDuration | number | 0 | Minimum duration in milliseconds |
| onComplete | () => void | undefined | Callback when minDuration completes |

## Examples

### Example 1: Simple 2-second loading
```typescript
const { isLoading, showLoading } = useLoading();

const handleClick = () => {
  showLoading(2, 'Processing...');
};
```

### Example 2: API call with minimum 3 seconds
```typescript
const { isLoading, withLoading } = useLoading();

const handleSubmit = async () => {
  await withLoading(async () => {
    const response = await api.post('/data', formData);
    return response.data;
  }, 3, 'Submitting...');
};
```

### Example 3: Manual control

```typescript
const { isLoading, loadingMessage, startLoading, stopLoading } = useLoading();

const handleProcess = async () => {
  startLoading('Processing data...');
  try {
    await processData();
  } finally {
    stopLoading();
  }
};

return (
  <>
    {isLoading && <LoadingScreen message={loadingMessage} />}
    <button onClick={handleProcess}>Process</button>
  </>
);
```

### Example 4: Different messages for different actions

```typescript
const { isLoading, loadingMessage, withLoading } = useLoading();

const handleSave = () => withLoading(saveData, 2, 'Saving...');
const handleDelete = () => withLoading(deleteData, 2, 'Deleting...');
const handleUpload = () => withLoading(uploadFile, 3, 'Uploading...');

return (
  <>
    {isLoading && <LoadingScreen message={loadingMessage} />}
    <button onClick={handleSave}>Save</button>
    <button onClick={handleDelete}>Delete</button>
    <button onClick={handleUpload}>Upload</button>
  </>
);
```

## Styling

The loading screen includes:
- Full-screen dark overlay (95% opacity)
- DB logo with pulse animation
- Red spinning loader
- Customizable message text

Colors match the FSM DataBridge theme:
- Background: Black (#000000)
- Primary: FSM Red (#C8102E)
- Text: White (#FFFFFF)

## Animations

- **Logo**: Pulses (scale + opacity) every 2 seconds
- **Spinner**: Rotates continuously (1 second per rotation)

## Best Practices

1. **Use minimum durations** for better UX (users see the loading state)
2. **Provide clear messages** (e.g., "Logging in...", "Saving data...")
3. **Handle errors** properly (loading stops on error)
4. **Don't overuse** (only for significant operations)

## Common Durations

- Quick operations: 1-2 seconds
- Login/Authentication: 2-3 seconds
- Data submission: 2-3 seconds
- File upload: 3-5 seconds
- Heavy processing: 3-5 seconds

## Notes

- Loading screen has `z-index: 9999` (appears above everything)
- Blocks all user interaction while visible
- Automatically handles timing and cleanup
- Works with any async operation
