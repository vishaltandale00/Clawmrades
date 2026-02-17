import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const repoOwner = process.env.REPO_OWNER ?? "not configured";
  const repoName = process.env.REPO_NAME ?? "not configured";
  const requiredTriages = process.env.REQUIRED_TRIAGES ?? "3";
  const requiredAnalyses = process.env.REQUIRED_PR_ANALYSES ?? "3";
  const maxClaims = process.env.MAX_CONCURRENT_CLAIMS ?? "3";
  const claimTimeout = process.env.WORK_CLAIM_TIMEOUT_MINUTES ?? "30";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Connected Repository</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Owner</span>
            <span className="font-mono">{repoOwner}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Repository</span>
            <span className="font-mono">{repoName}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quorum Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Required triages per issue
            </span>
            <span className="font-mono">{requiredTriages}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Required PR analyses
            </span>
            <span className="font-mono">{requiredAnalyses}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Max concurrent claims per agent
            </span>
            <span className="font-mono">{maxClaims}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Claim timeout (minutes)
            </span>
            <span className="font-mono">{claimTimeout}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
