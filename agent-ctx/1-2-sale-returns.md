# Task 1-2: Sale Returns Feature — API + Page

## Files Created

### 1. API Route: `src/app/api/sale-returns/route.ts`
- **GET** with `?invoiceNo=XXX` — looks up an original sale by invoice number (returns sale with items + customer) for the "New Return" dialog
- **GET** with `?startDate=&endDate=` — lists all sale returns with optional date range filter, includes customer and items
- **POST** — creates a sale return:
  - Validates original sale exists
  - Generates `RET-{000001}` return number from Settings.saleReturnNo
  - Uses `db.$transaction` for atomicity:
    - Increments settings.saleReturnNo
    - Creates SaleReturn + SaleReturnItem records
    - Adds returned quantities back to product stock
    - If credit sale, decrements customer balance by return total

### 2. Page Component: `src/components/pos/SaleReturnsPage.tsx`
- Follows same patterns as ExpensesPage (table-based listing, Cards, Dialog, dark mode, i18n)
- **Header** with "New Return" button (orange theme via `bg-orange-600`)
- **Date filter** card with start/end date inputs
- **Summary card** showing total returns amount
- **Returns table** with columns: Return No (badge), Original Invoice, Customer, Return Total, Date, Items count
- **New Return Dialog** with two-step flow:
  1. **Search step**: Enter original invoice number, press Enter or click Search → fetches via `GET /api/sale-returns?invoiceNo=`
  2. **Items step**: Shows original sale info card, items table with editable return quantities (clamped 0–originalQty), "Return All" button, running total, Back/Submit actions
- Permission check: `hasPermission('sales')`
- Loading states: spinner on initial load and submit
- All i18n keys used: `sr.title`, `sr.new`, `sr.return_no`, `sr.original_invoice`, `sr.search_invoice`, `sr.no_returns`, `sr.return_qty`, `sr.return_all`
- Additional Urdu/English inline strings for labels not in i18n yet