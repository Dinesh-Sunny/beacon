// Adapted from shadcn/ui (MIT): apps/v4/registry/bases/radix/blocks/preview. Regenerate with the design-system skill.
"use client"

import { ActivateAgentDialog } from "./activate-agent-dialog"
import { AnalyticsCard } from "./analytics-card"
import { AnomalyAlert } from "./anomaly-alert"
import { BarChartCard } from "./bar-chart-card"
import { BookAppointment } from "./book-appointment"
import { CodespacesCard } from "./codespaces-card"
import { ContributionsActivity } from "./contributions-activity"
import { Contributors } from "./contributors"
import { EnvironmentVariables } from "./environment-variables"
import { FeedbackForm } from "./feedback-form"
import { FileUpload } from "./file-upload"
import { GithubProfile } from "./github-profile"
import { IconPreviewGrid } from "./icon-preview-grid"
import { InviteTeam } from "./invite-team"
import { Invoice } from "./invoice"
import { LiveWaveformCard } from "./live-waveform"
import { NoTeamMembers } from "./no-team-members"
import { NotFound } from "./not-found"
import { ObservabilityCard } from "./observability-card"
import { PieChartCard } from "./pie-chart-card"
import { ReportBug } from "./report-bug"
import { ShippingAddress } from "./shipping-address"
import { Shortcuts } from "./shortcuts"
import { SkeletonLoading } from "./skeleton-loading"
import { SleepReport } from "./sleep-report"
import { StyleOverview } from "./style-overview"
import { TypographySpecimen } from "./typography-specimen"
import { UIElements } from "./ui-elements"
import { UsageCard } from "./usage-card"
import { Visitors } from "./visitors"
import { WeeklyFitnessSummary } from "./weekly-fitness-summary"

export default function PreviewExample() {
  return (
    <div className="overflow-x-auto overflow-y-hidden bg-muted contain-[paint] [--gap:--spacing(4)] 3xl:[--gap:--spacing(12)] md:[--gap:--spacing(10)] dark:bg-background style-lyra:md:[--gap:--spacing(6)] style-mira:md:[--gap:--spacing(6)]">
      <div className="flex w-full min-w-max justify-center">
        <div
          className="grid w-[2400px] grid-cols-7 items-start gap-(--gap) bg-muted p-(--gap) md:w-[3000px] dark:bg-background style-lyra:md:w-[2600px] style-mira:md:w-[2600px] *:[div]:gap-(--gap)"
          data-slot="capture-target"
        >
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <StyleOverview />
            <TypographySpecimen />
            <div className="md:hidden">
              <UIElements />
            </div>
            <CodespacesCard />
            <Invoice />
          </div>
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <IconPreviewGrid />
            <div className="hidden w-full md:flex">
              <UIElements />
            </div>
            <ObservabilityCard />
            <ShippingAddress />
          </div>
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <EnvironmentVariables />
            <BarChartCard />
            <InviteTeam />
            <ActivateAgentDialog />
          </div>
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <SkeletonLoading />
            <PieChartCard />
            <NoTeamMembers />
            <ReportBug />
            <Contributors />
          </div>
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <FeedbackForm />
            <BookAppointment />
            <SleepReport />
            <GithubProfile />
          </div>
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <WeeklyFitnessSummary />
            <FileUpload />
            <AnalyticsCard />
            <UsageCard />
            <Shortcuts />
          </div>
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <AnomalyAlert />
            <LiveWaveformCard />
            <Visitors />
            <ContributionsActivity />
            <NotFound />
          </div>
        </div>
      </div>
    </div>
  )
}
