1. **First impression opens as a dark app, against the required FOLIO direction.**  
   Fix: change page background from `#141411` to warm cream `#F4F0E6`; change main text to `#141411`; keep teal as the only accent `#22C7C8`. Use charcoal only for borders/shadows, not the whole canvas.

2. **Home builder is clipped below the fold; the user cannot see the final action.**  
   Fix: on 1536×900, make the entire builder fit above the fold: set hero headline to `font-size: 76px`, `line-height: 0.92`, reduce top margin above the builder to `32px`, and cap the builder card height at `500px`. Add the primary button inside the visible area: `Create basket` at the bottom of the left column, `height: 56px`, `width: 100%`.

3. **The default basket is invalid: weights total 74%, but the UI still shows a value and looks mintable.**  
   Fix: change default weights to total `100%`: `NVDA 45%`, `AAPL 35%`, `TSLA 20%`. Replace the pill `74% weights` with `100% allocated`. If weights are not 100%, disable creation and show `Add 26% to continue`.

4. **“Big Tech 5” shows only 3 stocks, which makes the product feel broken.**  
   Fix: either add two rows or rename it. Fastest fix: change basket name from `Big Tech 5` to `Big Tech 3`; change symbol from `BT5` to `BT3`; change every generated label accordingly.

5. **Basket page says “Local Three / LOC3”, which reads like localhost/demo data.**  
   Fix: replace `Local Three` with `Tech Three`; replace ticker `LOC3` with `TECH3`; remove every visible “Local” reference. Do not ship any “local chain” naming in the UI.

6. **Mint ticket does not show the real total cost before the user clicks.**  
   Fix: under the stock deposit list, add these exact rows:  
   - `Stock deposit value` → `$99.99`  
   - `Creator fee 0.30%` → `$0.30`  
   - `Total cost` → `$100.29`  
   - `You receive` → `1 TECH3 worth $99.99`  
   Button text should be `Mint 1 TECH3`.

7. **The mint flow hides the approval reality until after the button.**  
   Fix: above the button, add an approval status row: `Approvals needed: NVDA, AAPL, TSLA`. If none approved, change button from `Mint LOC3` to `Approve 3 stocks`. After approvals, change it to `Mint 1 TECH3`.

8. **Fraunces is overused on data-heavy controls, hurting readability.**  
   Fix: keep Fraunces only for `h1`, `h2`, and the logo. Change nav, labels, inputs, tickets, prices, and table values to `Inter Tight`. Set numeric fields to `font-variant-numeric: tabular-nums`; use `font-weight: 700` for prices and token amounts.