# SlipSafe Design Guidelines

## Design Approach: Material Design System

**Rationale**: SlipSafe is a utility-focused productivity application requiring clear information hierarchy, data-dense layouts, and reliable interaction patterns. Material Design provides the structure needed for receipt management, deadline tracking, and claim verification workflows.

**Key Principles**:
- Information clarity over visual flourish
- Predictable, efficient interactions
- Mobile-first responsive design (PWA-ready)
- Strong visual feedback for data states

---

## Typography System

**Font Family**: Inter from Google Fonts (primary), system fallback
```
Headings: Inter (600 - Semibold)
Body: Inter (400 - Regular)
Data/Numbers: Inter (500 - Medium) for emphasis
Labels: Inter (500 - Medium, uppercase, letter-spacing)
```

**Hierarchy**:
- Page Title: text-3xl font-semibold
- Section Headers: text-xl font-semibold
- Card Titles: text-lg font-semibold
- Data Labels: text-sm font-medium uppercase tracking-wide
- Body Text: text-base
- Metadata/Timestamps: text-sm
- Supporting Text: text-xs

---

## Layout & Spacing System

**Tailwind Units**: Standardize on 4, 6, 8, 12, 16, 24 for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: space-y-6 to space-y-8
- Card gaps: gap-4
- List item spacing: space-y-3
- Button padding: px-6 py-3

**Container Strategy**:
- Max-width: max-w-4xl for main content areas
- Dashboard grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Forms: max-w-2xl centered
- Full-width tables on desktop, card-style on mobile

---

## Component Library

### Navigation
- Top app bar with SlipSafe logo, main navigation, user menu
- Sticky positioning on scroll
- Mobile: Hamburger menu with slide-out drawer

### Receipt Upload Zone
- Prominent dropzone with dashed border
- Camera icon, "Upload Receipt" text, "or drag and drop" subtitle
- File type indicators (JPEG, PNG, PDF)
- Preview thumbnail after upload with remove option

### Receipt Cards
```
Structure:
- Merchant name (text-lg font-semibold)
- Receipt date and amount (text-sm)
- Category badge (rounded-full px-3 py-1 text-xs)
- Return/Warranty status indicators with icons
- Thumbnail preview (if image available)
- Hover state: subtle elevation increase
```

### Data Display Patterns
- **Receipt Details**: Two-column grid (label: value pairs)
- **Deadline Indicators**: 
  - Progress bars showing time remaining
  - Status badges: "Active" | "Expiring Soon" | "Expired"
  - Countdown text (e.g., "14 days left")
- **Search/Filter Bar**: Input with search icon, filter dropdowns inline

### Claims Generation
- Large QR code display (center-aligned, 256x256px)
- 6-digit PIN in monospace font (text-4xl, letter-spacing-wider)
- Copy buttons with icon + text
- Verifier URL as clickable link
- Share options row below

### Verifier Page
- Clean, centered layout (max-w-lg)
- Large MATCH/NO MATCH status header
- Receipt details comparison table
- Staff instruction paragraph in rounded border callout
- Print button footer

### Forms
- Material Design style floating labels
- Input fields with bottom border focus states
- Helper text below fields
- Primary action button right-aligned
- Secondary actions left-aligned

### Tables/Lists
- Desktop: Traditional table with sortable headers
- Mobile: Card-based list with key info visible
- Zebra striping for readability
- Row hover states

### Empty States
- Centered icon (96x96px)
- Heading: "No receipts yet"
- Description text
- Primary action button

### Status Elements
- Chips/Badges: rounded-full with icon + text
- Toast notifications: bottom-right, auto-dismiss
- Loading states: skeleton screens for data loading

---

## Layout Patterns

### Dashboard Layout
```
- Header bar (sticky)
- Stats cards row (3 columns on desktop)
- Recent receipts section (scrollable list)
- Expiring warranties widget (sidebar on desktop, stacked mobile)
```

### Receipt Detail Page
```
- Back navigation
- Receipt image viewer (full-width, lightbox on click)
- Details grid (2 columns)
- Action buttons row (Create Claim, Delete)
- Related items section
```

### Upload Flow
```
- Upload zone (centered, max-w-2xl)
- Progress indicator during OCR
- Parsed data review (editable fields)
- Confirm/Edit buttons
```

---

## Responsive Breakpoints

- Mobile: < 768px (single column, stacked layout)
- Tablet: 768px - 1024px (2 columns where appropriate)
- Desktop: > 1024px (full multi-column layouts)

---

## Iconography

**Library**: Heroicons (outline style via CDN)
- Navigation: HomeIcon, DocumentTextIcon, ClockIcon, CogIcon
- Actions: UploadIcon, PlusIcon, TrashIcon, PencilIcon
- Status: CheckCircleIcon, XCircleIcon, ExclamationIcon
- Utility: SearchIcon, FilterIcon, ShareIcon, QrcodeIcon

**Size Standards**: w-5 h-5 (general), w-6 h-6 (prominent actions)

---

## Micro-interactions

**Minimal approach - use sparingly**:
- Button press: scale-95 on active
- Card hover: subtle shadow transition (transition-shadow duration-200)
- Toast slide-in from bottom-right
- Loading spinner for async operations
- No page transitions, keep navigation instant

---

## PWA Considerations

- Touch-friendly tap targets (min 44x44px)
- Bottom navigation consideration for mobile
- Offline state messaging
- Install prompt design

---

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support (visible focus rings)
- Color-independent status indicators (icons + text)
- Form field error states with descriptive messages
- Semantic HTML structure