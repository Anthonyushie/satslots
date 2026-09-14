"use client";
import { Icon, useExperience } from "./experience-context";
import { NativeDialog, DialogTop } from "./native-dialog";
import { CampaignArea } from "./campaign-area";
import { PublisherForm } from "./publisher-form";
import { PlacementDetails } from "./placement-details";

export function DialogLayer() {
  const { modal, listings, closeModal } = useExperience();
  const selected =
    modal?.kind === "placement"
      ? listings.find((listing) => listing.address === modal.listingAddress)
      : undefined;
  return (
    <>
      <NativeDialog
        id="publisher-dialog"
        labelledBy="publisher-title"
        active={modal?.kind === "publisher"}
      >
        <DialogTop closeLabel="Close listing form">
          YOUR CORNER OF THE INTERNET
        </DialogTop>
        <h2 id="publisher-title">
          Make a little <em>room.</em>
        </h2>
        <p className="dialog-lead">
          Prepare your listing details. Publishing is blocked until backend
          authentication and database persistence are available.
        </p>
        <PublisherForm />
      </NativeDialog>
      <NativeDialog
        id="placement-dialog"
        labelledBy="placement-title"
        active={modal?.kind === "placement" && !!selected}
      >
        <DialogTop closeLabel="Close placement details">
          EXPLORE A PLACEMENT
        </DialogTop>
        {selected ? (
          <PlacementDetails key={selected.address} listing={selected} />
        ) : (
          <div id="placement-content" />
        )}
      </NativeDialog>
      <NativeDialog
        id="campaigns-dialog"
        labelledBy="campaigns-title"
        active={modal?.kind === "campaigns"}
      >
        <DialogTop closeLabel="Close campaign workspace">
          PLAN SOMETHING GOOD
        </DialogTop>
        {modal?.kind === "campaigns" && <CampaignArea />}
      </NativeDialog>
      <NativeDialog
        id="about-dialog"
        labelledBy="about-title"
        active={modal?.kind === "about"}
      >
        <DialogTop closeLabel="Close project notes">
          THE SMALL PRINT, IN NORMAL SIZE
        </DialogTop>
        <h2 id="about-title">
          A starting <em>point.</em>
        </h2>
        <p className="dialog-lead">
          SatSlots is a proposed open-source sponsorship marketplace for the
          BOSS Battle 2026 Freedom Stack track. It is not an official Bitshala
          product or an endorsed entry.
        </p>
        <div className="project-note">
          <h3>What works here</h3>
          <p>
            Nostr identity connection, public profile lookup, relay marketplace
            discovery, placement filters, and listing details.
          </p>
          <h3>What still needs building</h3>
          <p>
            Authenticated backend sessions, database-backed publishing, website
            ownership checks, publisher approval, Lightning invoice settlement,
            banner delivery, and dispute handling.
          </p>
          <h3>Privacy and relay access</h3>
          <p>
            Public relay queries expose your IP address to relay operators. No
            analytics or advertising trackers are included. Form inputs stay in
            memory and disappear on reload. Fonts and styles are bundled
            locally.
          </p>
        </div>
        <button
          type="button"
          className="button button-ink w-full"
          data-close-dialog=""
          onClick={closeModal}
        >
          Back to the good stuff <Icon name="arrow-right" />
        </button>
      </NativeDialog>
    </>
  );
}
