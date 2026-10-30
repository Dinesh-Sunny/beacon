// Adapted from shadcn/ui (MIT): apps/v4/registry/bases/radix/blocks/preview-02. Regenerate with the design-system skill.
import { Suspense } from "react"
import { AccountAccess } from "./account-access"
import { CardOverview } from "./card-overview"
import { ClaimableBalance } from "./claimable-balance"
import { ContributionHistory } from "./contribution-history"
import { CoverArt } from "./cover-art"
import { DividendIncome } from "./dividend-income"
import { EmptyConnectBank } from "./empty-connect-bank"
import { EmptyDistributeTrack } from "./empty-distribute-track"
import { EmptyExploreCatalog } from "./empty-explore-catalog"
import { Faq } from "./faq"
import { FrontDoor } from "./front-door"
import { IndexInvesting } from "./index-investing"
import { KitchenIsland } from "./kitchen-island"
import { LoadingCard } from "./loading-card"
import { NewMilestone } from "./new-milestone"
import { NotificationSettings } from "./notification-settings"
import { Payments } from "./payments"
import { PayoutThreshold } from "./payout-threshold"
import { PowerUsage } from "./power-usage"
import { Preferences } from "./preferences"
import { QrConnect } from "./qr-connect"
import { ReceivingMethod } from "./receiving-method"
import { RecentTransactions } from "./recent-transactions"
import { ReleaseCatalog } from "./release-catalog"
import { RollerShades } from "./roller-shades"
import { SavingsProgress } from "./savings-progress"
import { SavingsTargets } from "./savings-targets"
import { SidebarNav } from "./sidebar-nav"
import { SocialLinks } from "./social-links"
import { StockPerformance } from "./stock-performance"
import { SyncingState } from "./syncing-state"
import { TransferFunds } from "./transfer-funds"
import { UpcomingPayments } from "./upcoming-payments"

export default function Preview02Example() {
  return (
    <div className="overflow-x-auto overflow-y-hidden bg-muted contain-[paint] [--gap:--spacing(4)] 3xl:[--gap:--spacing(12)] md:[--gap:--spacing(10)] dark:bg-background style-lyra:md:[--gap:--spacing(6)] style-mira:md:[--gap:--spacing(6)]">
      <div className="flex w-full min-w-max justify-center">
        <div
          className="grid w-[2400px] grid-cols-7 items-start gap-(--gap) bg-muted p-(--gap) md:w-[3000px] dark:bg-background style-lyra:md:w-[2600px] style-mira:md:w-[2600px] *:[div]:gap-(--gap)"
          data-slot="capture-target"
        >
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <ContributionHistory />
            <EmptyDistributeTrack />
            <QrConnect />
            <DividendIncome />
            <IndexInvesting />
            <SyncingState />
          </div>
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <PayoutThreshold />
            <ClaimableBalance />
            <Preferences />
            <SavingsProgress />
            <KitchenIsland />
          </div>
          <div className="col-span-2 flex flex-col p-1 [contain-intrinsic-size:760px_1200px] [content-visibility:auto]">
            <SavingsTargets />
            <RecentTransactions />
            <div className="grid grid-cols-2 items-start gap-(--gap)">
              <div className="flex flex-col gap-(--gap)">
                <SidebarNav />
                <Faq />
              </div>
              <div className="flex flex-col gap-(--gap)">
                <Payments />
                <FrontDoor />
              </div>
            </div>
            <ReleaseCatalog />
          </div>
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <AccountAccess />
            <CardOverview />
            <TransferFunds />
            <CoverArt />
            <LoadingCard />
          </div>
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <ReceivingMethod />
            <PowerUsage />
            <EmptyConnectBank />
            {/* The calendar reads the clock while rendering; stream it instead of prerendering. */}
            <Suspense>
              <UpcomingPayments />
            </Suspense>
            <RollerShades />
          </div>
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <StockPerformance />
            <EmptyExploreCatalog />
            <NewMilestone />
            <SocialLinks />
            <NotificationSettings />
          </div>
        </div>
      </div>
    </div>
  )
}
