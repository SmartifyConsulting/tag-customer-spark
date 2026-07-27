## Plan

1. **Stop the product-update error**
   - Add the missing backend policy/permission path for `intent_recompute_queue` so normal product edits can enqueue intent recalculation without throwing `new row violates row-level security policy`.
   - Keep direct user access narrow: users should not browse or manually manage the queue; product triggers/functions should be the only app path that writes it.

2. **Default Store to the uploader’s store**
   - Product upload/import should use the branch/store associated with the uploader when the file row does not include a store/branch column.
   - If the file explicitly contains a store/branch, that row’s store continues to win.
   - If the uploader is not tied to a staff store, fall back to the existing behaviour: row store if present, sole-store default only when there is exactly one store, otherwise leave it unassigned for manual selection.

3. **Fix Jumper / existing QR store identity**
   - The Jumper currently has `product.store_id = Checkers Centurion`, but its active QR asset has `store_id = null`, so the Digital Identity checklist stays unticked.
   - Update QR generation so an existing product’s `store_id` becomes the default QR store identity when regenerating or bulk-building QR assets.
   - Add a small repair path for existing active QR assets: if the QR has no store but the product does, stamp the product’s store onto the QR asset so the checklist immediately reflects the real branch.

4. **Correct “Tagged” semantics**
   - A completed Digital Identity Build / active QR does **not** mean “Tagged”.
   - Change inventory filtering/list labels so **Tagged = at least one real customer scan exists** for that product.
   - Products with QR/Digital Identity complete but zero scans should remain untagged until someone scans the shelf/customer-facing QR.

5. **Keep the Digital Identity UI consistent**
   - Store Identity step should tick when the active QR has a store identifier.
   - Ensure the QR panel displays the assigned store name and unique TAG store code neatly after the repair/regeneration.

## Technical notes

- I confirmed the Jumper product has `store_id = Checkers Centurion`, active QR status, zero scans, and `qr.store_id = null`.
- I confirmed the current product list marks `is_tagged` from `product_qr_assets`, which is why Digital Identity completion can look like “Tagged” before any scan.
- I confirmed product edits update `products`, and the `products` trigger calls the intent recompute queue path; that is the error path to fix.