import { mainEntryFunction } from "./app";
import { catchUpAllGroups } from "./modules/chore/chore.engine";

const app = mainEntryFunction();

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Advances chore rotations and records overdue fines even when nobody opens the app.
setInterval(() => {
  catchUpAllGroups().catch((error) => console.log("chore catch-up failed:", error));
}, 60_000);
