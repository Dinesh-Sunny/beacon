import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataExportButton } from "./DataExportButton";

// "Download your data" (UK GDPR Art. 15 and 20). The button fetches the file so a rate limit
// or failure shows on the page instead of being saved as the download.
export function DataExportPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Your data</h2>
        </CardTitle>
        <CardDescription>
          A JSON file with your profile, sign-ins, organizations, cookie
          choices, assistant conversations, and activity.
        </CardDescription>
        <CardAction>
          <DataExportButton />
        </CardAction>
      </CardHeader>
    </Card>
  );
}
