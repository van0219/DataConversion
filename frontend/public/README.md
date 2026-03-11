# FSM DataBridge Icons

## Files

- **databridge-icon.svg** - Main favicon (SVG format, scalable)
- **favicon.ico** - Fallback icon for older browsers
- **apple-touch-icon.png** - iOS home screen icon (180x180)

## Design

The DataBridge icon represents:
- **Bridge structure** - Connecting source to destination
- **Red color (#C8102E)** - FSM brand color
- **Black background** - Professional, modern look
- **White data flow** - Data moving across the bridge
- **S and D nodes** - Source and Destination endpoints

## Icon Specifications

### Colors
- Background: #000000 (Black)
- Primary: #C8102E (FSM Red)
- Accent: #FFFFFF (White)

### Sizes
- SVG: Scalable (used for modern browsers)
- ICO: 16x16, 32x32, 48x48 (for older browsers)
- Apple Touch: 180x180 (for iOS devices)

## Usage

The icon is automatically loaded via `index.html`:

```html
<link rel="icon" type="image/svg+xml" href="/databridge-icon.svg" />
<link rel="alternate icon" type="image/x-icon" href="/favicon.ico" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
```

## Production Notes

For production deployment:
1. Convert `databridge-icon.svg` to ICO format (16x16, 32x32, 48x48)
2. Convert `databridge-icon.svg` to PNG format (180x180) for Apple Touch Icon
3. Consider adding additional sizes for Android (192x192, 512x512)

## Tools for Conversion

- **SVG to ICO**: https://convertio.co/svg-ico/
- **SVG to PNG**: https://svgtopng.com/
- **Favicon Generator**: https://realfavicongenerator.net/

## Browser Support

- ✅ Chrome/Edge: SVG favicon
- ✅ Firefox: SVG favicon
- ✅ Safari: SVG favicon
- ✅ iOS Safari: Apple Touch Icon
- ✅ IE11: ICO fallback
