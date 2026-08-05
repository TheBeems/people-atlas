export type SupportedLocale = "en" | "nl";

type MyPersonDescriptionParameters = {
	name: string;
	filePath: string;
};

type MyPersonWarningParameters = {
	id: string;
	count?: number;
};

type SettingsSaveFailureParameters = {
	error: string;
};

type RelationshipTemplateParameters = {
	id: string;
	types: string;
	fromRole: string;
	toRole: string;
};

type TemplateNameParameters = {
	name: string;
};

type TemplateCountParameters = {
	count: number;
};

type TemplateUnavailableParameters = {
	presetId: string;
};

const englishCatalog = {
	commandOpenAtlas: "Open atlas",
	commandOpenFollowUps: "Open follow-ups",
	commandCreatePerson: "Create person",
	commandEditCurrentPerson: "Edit current person",
	commandCreateRelationship: "Create relationship",
	commandEditCurrentRelationship: "Edit current relationship",
	commandLogContact: "Log contact",
	commandEditCurrentContactMoment: "Edit current contact moment",
	ribbonOpenPeopleAtlas: "Open People Atlas",
	settingsGeneral: "General",
	settingsPeopleRootFolderName: "People root folder",
	settingsPeopleRootFolderDescription:
		"Vault-relative root for the fixed Profiles, Relationships and Contact moments collections.",
	settingsMyPersonName: "My person",
	settingsMyPersonPlaceholder: "Select a person note",
	settingsMyPersonSelectedDescription: ({ name, filePath }: MyPersonDescriptionParameters) =>
		`Perspective anchor: ${name} — ${filePath}. It stays independent from graph navigation.`,
	settingsMyPersonNoCandidatesDescription:
		"No valid person notes are indexed yet. Create or repair a canonical person note, then select it here.",
	settingsMyPersonChooseDescription:
		"Select one unique canonical person note as the perspective anchor. It stays independent from graph navigation.",
	settingsMyPersonUnavailableWarning: ({ id }: MyPersonWarningParameters) =>
		`My person ID “${id}” is not available in the canonical index.`,
	settingsMyPersonAmbiguousWarning: ({ id, count }: MyPersonWarningParameters) =>
		`My person ID “${id}” is ambiguous across ${count} person notes.`,
	settingsWarningPrefix: "Warning",
	settingsRelationshipTemplatesHeading: "Relationship templates",
	settingsRelationshipTemplatesEmpty: ({ readOnly }: { readOnly: boolean }) =>
		`No relationship templates yet. Relationship types and roles can still be entered manually. Templates copy repeatable types and both roles; they are not live links.${
			readOnly ? " Template settings are read-only until the People Atlas plugin data is repaired." : ""
		}`,
	settingsRelationshipTemplateDescription: ({ id, types, fromRole, toRole }: RelationshipTemplateParameters) =>
		`${id} · types: ${types} · first-person role: ${fromRole} · second-person role: ${toRole}`,
	settingsEdit: "Edit",
	settingsEditTemplateTooltip: ({ name }: TemplateNameParameters) => `Edit ${name} relationship template`,
	settingsTemplateReadOnly:
		"Relationship template settings are read-only until the People Atlas plugin data is repaired.",
	settingsUpdateLinkedRelationships: "Update linked relationships from template",
	settingsUpdateTemplateReadOnly: "Relationship template updates are read-only until the plugin data is repaired.",
	settingsReviewTemplateChanges: ({ count }: TemplateCountParameters) =>
		`Review ${count} relationship note${count === 1 ? "" : "s"} with this template provenance`,
	settingsTemplateAlreadyMatches:
		"All indexed relationship notes with this template provenance already match its copied values.",
	settingsAddRelationshipTemplate: "Add relationship template",
	settingsShowLabelsName: "Show labels",
	settingsShowLabelsDescription: "Draw person names below nodes by default.",
	noticeSettingsReadOnly: "People Atlas settings are read-only until the plugin data is repaired.",
	noticeSettingsSaveFailed: ({ error }: SettingsSaveFailureParameters) =>
		`People Atlas settings could not be saved: ${error}`,
	noticeTemplateUnavailable: ({ presetId }: TemplateUnavailableParameters) =>
		`Relationship template “${presetId}” is no longer available.`,
	noticeTemplateAlreadyMatches:
		"All indexed relationship notes with this template provenance already match its copied values.",
	noticeFollowUpMarkedDone: "Follow-up marked done.",
	noticeFollowUpDismissed: "Follow-up dismissed.",
	relationshipModal: {
		titleCreate: "Create relationship",
		titleEdit: "Edit relationship",
		groupPeople: "People",
		firstPerson: "First person",
		firstPersonSelected: ({ name }: { name: string }) => `First person — ${name}`,
		firstPersonDescription: "Choose one canonical indexed person as the first selected person.",
		secondPerson: "Second person",
		secondPersonSelected: ({ name }: { name: string }) => `Second person — ${name}`,
		secondPersonDescription: "Choose one canonical indexed person as the second selected person.",
		groupRelationship: "Relationship",
		simpleRelationship: "Simple relationship",
		simpleRelationshipDescription:
			"Optional shortcut from the first person to the second person. It fills only both unsaved roles; Custom keeps the roles below unchanged.",
		simpleCustom: "Custom — use template or roles below",
		simpleParent: "Parent of the second person",
		simpleChild: "Child of the second person",
		simpleSibling: "Sibling of the second person",
		simplePartner: "Partner of the second person",
		relationshipTemplate: "Relationship template",
		relationshipTemplateDescription:
			"Templates copy repeatable relationship types and roles for both selected people into this form; they are not live links.",
		noRelationshipTemplates: "No relationship templates yet",
		noRelationshipTemplatesDescription:
			"Manual relationship values remain available. Templates copy repeatable types and both roles into the form; saved relationship notes keep those copied values.",
		createTemplate: "Create template",
		applyLatestTemplateValues: "Apply latest template values",
		relationshipTypes: "Relationship types",
		relationshipTypesDescription:
			"Optional comma-separated labels. A template may copy these values into the unsaved form.",
		firstPersonRole: "First person's role",
		myRole: "My role",
		personRole: ({ name }: { name: string }) => `${name}'s role`,
		firstPersonRoleDescription:
			"Role held by the first selected person. Define roles for both selected people or leave both empty.",
		secondPersonRole: "Second person's role",
		secondPersonRoleDescription: "Role held by the second selected person. It stays with that person when you save.",
		groupContext: "Context",
		closeness: "Closeness",
		closenessDescription: "Optional value from 1 to 5.",
		since: "Since",
		sinceDescription: "Optional relationship start date.",
		lastContact: "Last contact",
		lastContactDescription: "Optional observation date; it never changes status automatically.",
		status: "Status",
		statusDescription: "Optional user-authored relationship status. Last contact never changes it automatically.",
		statusNotSet: "Not set",
		statusActive: "Active",
		statusDormant: "Dormant",
		statusEnded: "Ended",
		relationshipNotePath: "Relationship note path",
		sourceNotePath: "Source note path",
		relationshipNotePathDescription: "Review or edit the proposed Markdown path. Existing notes are never overwritten.",
		sourceNotePathDescription:
			"The current source path is read-only. Moving or renaming this relationship is outside the editor.",
		relationshipId: "Relationship ID",
		relationshipIdDescription: "A stable relationship_id is generated when a new relationship is saved.",
		cancel: "Cancel",
		save: "Save",
		noTemplate: "No template — enter values manually",
		missingTemplate: ({ presetId }: { presetId: string }) => `Missing template — ${presetId}`,
		templateCreationAvailable:
			"Create a reusable template without losing this unsaved relationship. It will not be selected automatically.",
		templateCreationUnavailable:
			"Template creation is unavailable because People Atlas settings are read-only or invalid. Manual relationship values remain available.",
		presetUnlinked:
			"No template is selected. Types and roles are stored directly on this relationship note when you save.",
		presetUpToDate: "The unsaved types and roles match the values copied from the selected template.",
		presetModified:
			"The unsaved types or roles differ from the selected template. Apply its latest values only if you want to replace them.",
		presetMissing: ({ presetId }: { presetId: string }) =>
			`Template “${presetId}” is unavailable. Its copied types and roles remain editable.`,
		rolePreviewPlaceholder:
			"Choose both people and define both roles to review how each selected person maps to a role.",
		rolePreview: ({
			fromName,
			fromRole,
			toName,
			toRole,
		}: {
			fromName: string;
			fromRole: string;
			toName: string;
			toRole: string;
		}) => `In this relationship, ${fromName}'s role is ${fromRole} and ${toName}'s role is ${toRole}.`,
		familyTerms: {
			mother: "mother",
			father: "father",
			daughter: "daughter",
			son: "son",
			sister: "sister",
			brother: "brother",
		},
		advancedDestination: ({ path }: { path: string }) => `Advanced — Destination: ${path}`,
		advancedSource: ({ path }: { path: string }) => `Advanced — Source: ${path}`,
		notSet: "not set",
	},
	relationshipPresetModal: {
		titleCreate: "Create relationship template",
		titleEdit: "Edit relationship template",
		description:
			"Templates copy relationship types, the first-person role and the second-person role into a relationship form; they are not live links. New relationships normally place My person first when it resolves, but templates also work for relationships between any two people. Roles always map to the first and second selected people.",
		templateId: "Template ID",
		name: "Name",
		relationshipTypes: "Relationship types",
		firstPersonRole: "First-person role",
		secondPersonRole: "Second-person role",
		cancel: "Cancel",
		save: "Save",
	},
	relationshipPresetSyncModal: {
		title: "Update linked relationships from template",
		cancel: "Cancel",
		confirm: "Update linked relationships from template",
		close: "Close",
		intro: ({ count, presetName }: { count: number; presetName: string }) =>
			`Review ${count} relationship note${count === 1 ? "" : "s"} whose stored template provenance is “${presetName}”. Confirming copies this template’s relationship types, first-person role and second-person role to the exact paths below. Endpoints, paths, relationship IDs, closeness, dates, status, unrelated frontmatter and note content stay unchanged.`,
		preview: ({ types, fromRole, toRole }: { types: string; fromRole: string; toRole: string }) =>
			`types: ${types}; first-person role: ${fromRole}; second-person role: ${toRole}`,
		none: "none",
		success: ({ completed, skipped }: { completed: number; skipped: number }) =>
			`Updated ${completed}; skipped ${skipped}; none remain from this preview.`,
	},
	relationshipPresetDelete: {
		title: ({ presetName }: { presetName: string }) => `Delete “${presetName}” relationship template?`,
		content: ({ linked }: { linked: number }) =>
			`This template is linked to ${linked} relationship note${linked === 1 ? "" : "s"}. Those notes will keep their copied types and roles. Their template provenance will no longer refer to an existing template.`,
		cancel: "Cancel",
		confirm: "Delete relationship template",
	},
	partnerParentConfirmation: {
		title: "Review partner as parent",
		question: ({ parent, partner, child }: { parent: string; partner: string; child: string }) =>
			`${parent} has partner ${partner}. Is ${partner} also a parent of ${child}?`,
		notNow: "Not now",
		reviewRelationship: "Review relationship",
	},
	personMentionSuggest: {
		navigate: "navigate",
		select: "select",
		dismiss: "dismiss",
		create: ({ name, directory }: { name: string; directory: string }) => `Create person “${name}” in ${directory}/`,
	},
	contactMomentModal: {
		titleCreate: "Log contact",
		titleEdit: "Edit contact moment",
		groupPeople: "People",
		people: "People",
		peopleDescription:
			"Choose one or more canonical people. Paths and stable IDs—not display names—are stored as identity.",
		relationship: "Relationship",
		relationshipDescription:
			"Optional. Only canonical relationship notes sharing at least one selected person can advance last contact.",
		groupMoment: "Contact moment",
		occurredOn: "Occurred on",
		occurredOnDescription: "Required local calendar date in YYYY-MM-DD form.",
		channel: "Channel",
		channelDescription: "Optional user-authored channel. Suggestions never infer a value.",
		summary: "Summary",
		summaryDescription: "Optional short summary. The Markdown body remains free content.",
		groupFollowUp: "Follow-up",
		followUpOn: "Follow-up on",
		followUpOnDescription: "Optional local calendar date.",
		followUpStatus: "Follow-up status",
		followUpStatusDescription:
			"Open, done and dismissed apply only to this follow-up and never change relationship status.",
		statusNotSet: "Not set",
		statusOpen: "Open",
		statusDone: "Done",
		statusDismissed: "Dismissed",
		advanceRelationshipLastContact: "Advance linked relationship's last contact to this date",
		advanced: "Advanced",
		contactMomentNotePath: "Contact moment note path",
		sourceNotePath: "Source note path",
		contactMomentNotePathDescription:
			"Review or edit the proposed Markdown path. Existing notes are never overwritten.",
		sourceNotePathDescription: "The current source path is read-only; moving or renaming is outside this editor.",
		contactMomentId: "Contact moment ID",
		contactMomentIdDescription: "Stable explicit identity assigned before the note is written.",
		cancel: "Cancel",
		retryRelationshipUpdate: "Retry relationship update",
		save: "Save",
		noLinkedRelationship: "No linked relationship",
		unknownPerson: "Unknown",
	},
	atlasRenderer: {
		view: "View",
		graph: "Graph",
		list: "List",
		followUps: "Follow-ups",
		interactiveAtlas: "Interactive people and relationship atlas",
		graphControls: "Graph controls",
		zoomOut: "Zoom out",
		zoomIn: "Zoom in",
		fit: "Fit",
		details: "Details",
		listView: "People atlas list view",
		noPeople: "No people in the current atlas",
		peopleInAtlas: "People in the current atlas",
		selectedPersonDetails: "Selected person details",
		contactFollowUps: "Contact follow-ups",
		selection: "Selection",
		selectPersonHint: "Select a person to review their visible relationships and actions.",
		ambiguousPerson: "Ambiguous person",
		unresolvedPerson: "Unresolved person",
		ambiguousPersonListLabel: "ambiguous person",
		unresolvedPersonListLabel: "unresolved person",
		semanticListSummary: ({
			people,
			connections,
			hiddenContactMoments,
		}: {
			people: number;
			connections: number;
			hiddenContactMoments: number;
		}) =>
			`${people} people · ${connections} connections${
				hiddenContactMoments > 0
					? ` · ${hiddenContactMoments} contact ${hiddenContactMoments === 1 ? "moment" : "moments"} hidden`
					: ""
			}`,
		relationships: "Relationships",
		relationship: "relationship",
		linkedPeople: "Linked people",
		openNote: "Open note",
		useAsCenter: "Use as center",
		editPerson: "Edit person",
		createRelationship: "Create relationship",
		logContact: "Log contact",
		close: "Close",
		ambiguousNoOpenCenter: "This person record is ambiguous and cannot be opened or centered.",
		unresolvedNoNote: "No note is available for this unresolved person.",
		noNote: "No note is available for this person.",
		noVisibleConnections: "No visible relationships or linked people",
		relationshipListFor: ({ group, name }: { group: string; name: string }) => `${group} for ${name}`,
		openRelationshipNote: "Open relationship note",
		editRelationship: "Edit relationship",
		ambiguousNoActions: "This person record is ambiguous. No actions are available.",
		unresolvedNoActions: "This unresolved person has no available actions.",
		noNoteNoActions: "This person has no note or available actions.",
		contactMoments: "Contact moments",
		nextFollowUp: "Next follow-up",
		allContactMoments: "All contact moments",
		recentContactMoments: "Recent contact moments",
		noContactMoments: "No contact moments",
		contactMomentListFor: ({ scope, name }: { scope: string; name: string }) => `${scope} contact moments for ${name}`,
		showRecentContactMoments: "Show recent contact moments",
		viewAllContactMoments: "View all contact moments",
		noOpenFollowUps: "No open follow-ups",
		followUpsSummary: ({ openCount, hiddenCount }: { openCount: number; hiddenCount: number }) =>
			`${openCount} open follow-up${openCount === 1 ? "" : "s"}${
				hiddenCount > 0 ? ` · ${hiddenCount} contact moment${hiddenCount === 1 ? "" : "s"} hidden` : ""
			}`,
		overdue: "Overdue",
		dueToday: "Due today",
		upcoming: "Upcoming",
		followUpPrefix: "Follow up ",
		contactPrefix: "Contact ",
		channel: ({ channel }: { channel: string }) => `Channel: ${channel}`,
		openContactMoment: "Open contact moment",
		editContactMoment: "Edit contact moment",
		markFollowUpDone: "Mark follow-up done",
		dismissFollowUp: "Dismiss follow-up",
		due: ({ date }: { date: string }) => `due ${date}`,
		unknownDate: "unknown date",
		contactActionName: ({ action, people, date }: { action: string; people: string; date: string }) =>
			`${action} for ${people}, ${date}`,
		actionWithContext: ({ action, context }: { action: string; context: string }) => `${action} ${context}`,
		contactActionContext: ({
			person,
			date,
			discriminator,
			placement,
		}: {
			person: string;
			date: string;
			discriminator: string;
			placement: string;
		}) => `for ${person}, ${date}${discriminator}${placement}`,
		contactEntry: ({ index, count }: { index: number; count: number }) => `, entry ${index} of ${count}`,
		followUpDue: ({ date }: { date: string }) => `, follow-up due ${date}`,
		contactOrdinal: ({ index, count }: { index: number; count: number }) => `contact ${index} of ${count}`,
		unavailablePerson: "Unavailable person",
		relationshipSummary: ({ source, target, kind }: { source: string; target: string; kind: string }) =>
			`Relationship: ${source} and ${target} · ${kind}`,
	},
	personProfile: {
		pronouns: "Pronouns",
		jobTitle: "Job title",
		organisations: "Organisations",
		birthDate: "Birth date",
		gender: "Gender",
		email: "Email",
		phone: "Phone",
		contactDetails: "Contact details",
		photoMissing: "Photo unavailable: the referenced vault image could not be found.",
		photoUnsupported: "Photo unavailable: this file type is not supported.",
		photoDecodeError: "Photo unavailable: the image could not be decoded.",
		photoUnavailable: "Photo unavailable: a safe vault resource could not be prepared.",
	},
	relationshipRows: {
		unresolvedSuffix: " (unresolved)",
		ambiguousSuffix: " (ambiguous)",
		linkedPerson: ({ name }: { name: string }) => `Linked person: ${name}.`,
		connectedTo: ({ name }: { name: string }) => `Connected to ${name}`,
		familyTerms: {
			mother: "mother",
			father: "father",
			daughter: "daughter",
			son: "son",
			sister: "sister",
			brother: "brother",
		},
		types: ({ types }: { types: string }) => `Types: ${types}`,
		status: ({ status }: { status: string }) => `Status: ${status}`,
		since: ({ since }: { since: string }) => `Since: ${since}`,
		lastContact: ({ lastContact }: { lastContact: string }) => `Last contact: ${lastContact}`,
		actionAccessibleName: ({ action, context }: { action: string; context: string }) => `${action} with ${context}`,
	},
	peopleAtlasView: {
		center: "Center",
		configuredCenter: "Configured center",
		activeNote: "Active note",
		selectedNode: "Selected node",
		noCenter: "No center",
		projection: "Projection",
		egoNetwork: "Ego network",
		freeNetwork: "Free network",
		contactHealth: "Contact health",
		allPeople: "All people",
		selectNodeHint: "Select a node. Double-click to center it; Shift-double-click to open its note.",
		personNoteUnavailable: "Person note unavailable",
		open: "Open",
		stats: ({ people, connections }: { people: number; connections: number }) =>
			`${people} people · ${connections} connections`,
	},
	basesView: {
		edit: ({ name }: { name: string }) => `Edit ${name}`,
		createRelationshipWith: ({ name }: { name: string }) => `Create relationship with ${name}`,
		logContactWith: ({ name }: { name: string }) => `Log contact with ${name}`,
	},
	readingView: {
		actions: "People Atlas actions",
		addRelationship: "Add relationship",
	},
	personModal: {
		titleCreate: "Create person",
		titleEdit: "Edit person",
		sectionBasic: "Basic",
		sectionProfile: "Profile",
		sectionContactDetails: "Contact details",
		sectionLinkedPeople: "Linked people",
		advanced: "Advanced",
		name: "Name",
		nameDescriptionCreate: "Required display name. The new note filename is derived from this value.",
		nameDescriptionEdit: "Changing the display name also proposes a filename change in the current folder.",
		createPhotoHint:
			"Photo: Save this person first to create its dossier. Place an image in the person's dossier yourself. Then open Edit and choose the dossier image.",
		aliases: "Aliases",
		aliasesDescription: "Optional alternative names, one per line.",
		pronouns: "Pronouns",
		pronounsDescription: "Optional user-authored pronouns. People Atlas does not infer relationship meaning from them.",
		gender: "Gender",
		genderDescription: "Optional user-authored gender. People Atlas does not infer relationship meaning from it.",
		jobTitle: "Job title",
		jobTitleDescription: "Optional current job title.",
		organisations: "Organisations",
		organisationsDescription: "Optional organisations, one per line.",
		emailAddresses: "Email addresses",
		emailAddressesDescription:
			"Add one address per entry. Each address needs one @; duplicates are compared without letter case.",
		phoneNumbers: "Phone numbers",
		phoneNumbersDescription: "Add one number per entry. Formatting and international prefixes are preserved.",
		personNotePath: "Person note path",
		currentPersonNotePath: "Current person note path",
		personNotePathDescriptionCreate: "The configured People folder and a safe filename determine this path.",
		personNotePathDescriptionEdit:
			"The note stays in this folder. A changed filename requires a separate confirmation.",
		personId: "Person ID",
		personIdDescription: "Stable identity planned before any vault write and managed by People Atlas.",
		cancel: "Cancel",
		save: "Save",
		photo: "Photo",
		photoDescription:
			"Stored vault path or wikilink. Use the dossier image picker or Clear photo to change it; unchanged authored text stays exact.",
		searchDossierImages: "Search dossier images",
		searchDossierImagesDescription:
			"Filter supported PNG, JPG, JPEG, WebP, GIF and AVIF files in this person's own dossier.",
		dossierImage: "Dossier image",
		dossierImageDescription:
			"Each choice from this person's own dossier uses its full vault-relative path, so equal filenames remain distinct.",
		clearPhoto: "Clear photo",
		noSupportedDossierImages: "No supported dossier images",
		noDossierImagesMatch: "No dossier images match",
		chooseDossierImage: "Choose a dossier image",
		selectedPhotoUnavailable: ({ path }: { path: string }) =>
			`The selected photo “${path}” is no longer uniquely available in the vault. Choose it again or clear the photo.`,
		photoEmpty: "No photo is selected. Initials will be shown.",
		photoExternal: "External or network photo references are not supported. Initials will be shown.",
		photoUnreadable: "The photo reference is not readable. Initials will be shown.",
		photoMissing: "The referenced vault image is missing. Initials will be shown.",
		photoUnsupported: "This photo format is unsupported. Choose a PNG, JPG, JPEG, WebP, GIF or AVIF image.",
		photoUnavailable: "The selected vault image is temporarily unavailable. Initials will be shown.",
		photoLoading: "Loading the selected vault image. Initials are shown until it is ready.",
		photoDecodeError: "The selected vault image could not be decoded. Initials will be shown.",
		birthDate: "Birth date",
		birthDateDescription:
			"Enter month and day. A four-digit year is optional; clearing only the year keeps a birthday without a known year.",
		month: "Month",
		monthDescription: "Month number from 1 to 12.",
		day: "Day",
		dayDescription: "Calendar-valid day for the selected month.",
		yearOptional: "Year (optional)",
		yearDescription: "Optional four-digit year from 0001 to 9999.",
		clearBirthDate: "Clear birth date",
		emailAddress: ({ index }: { index: number }) => `Email address ${index}`,
		phoneNumber: ({ index }: { index: number }) => `Phone number ${index}`,
		remove: "Remove",
		removeEmailAddress: ({ index }: { index: number }) => `Remove email address ${index}`,
		removePhoneNumber: ({ index }: { index: number }) => `Remove phone number ${index}`,
		addEmailAddress: "Add email address",
		addPhoneNumber: "Add phone number",
		linkedPeopleDescription:
			"Links are stored on this person note as simple connections. New links must resolve to one canonical, non-self person. Existing unresolved values remain until you remove them. Use Create relationship for roles, dates, status and other rich metadata.",
		unresolvedOrAmbiguous: ({ value }: { value: string }) => `Unresolved or ambiguous — ${value}`,
		removeLinkedPerson: ({ value }: { value: string }) => `Remove linked person ${value}`,
		addLinkedPerson: "Add a linked person",
		addLinkedPersonButton: "Add linked person",
		confirmRename: "Confirm person rename",
		renameExplanation:
			"Saving this name also renames the Markdown note. Obsidian updates links according to the vault setting for automatic link updates.",
		currentPath: "Current path",
		newPath: "New path",
		back: "Back",
		renameAndSave: "Rename and save",
		retryRenameAndSave: "Retry rename and save",
		advancedDestination: ({ path }: { path: string }) => `Advanced — Destination: ${path}`,
		advancedCurrentPath: ({ path }: { path: string }) => `Advanced — Current path: ${path}`,
	},
};

type LocalizedCatalogValue<Value> = Value extends (...args: infer Parameters) => string
	? (...args: Parameters) => string
	: Value extends object
		? { [Key in keyof Value]: LocalizedCatalogValue<Value[Key]> }
		: string;

type Catalog = LocalizedCatalogValue<typeof englishCatalog>;

const dutchCatalog: Catalog = {
	commandOpenAtlas: "Atlas openen",
	commandOpenFollowUps: "Opvolgacties openen",
	commandCreatePerson: "Persoon aanmaken",
	commandEditCurrentPerson: "Huidige persoon bewerken",
	commandCreateRelationship: "Relatie aanmaken",
	commandEditCurrentRelationship: "Huidige relatie bewerken",
	commandLogContact: "Contactmoment vastleggen",
	commandEditCurrentContactMoment: "Huidig contactmoment bewerken",
	ribbonOpenPeopleAtlas: "People Atlas openen",
	settingsGeneral: "Algemeen",
	settingsPeopleRootFolderName: "Hoofdmap voor personen",
	settingsPeopleRootFolderDescription:
		"Vault-relatieve hoofdmap voor de vaste collecties Profielen, Relaties en Contactmomenten.",
	settingsMyPersonName: "Mijn persoon",
	settingsMyPersonPlaceholder: "Selecteer een persoonsnotitie",
	settingsMyPersonSelectedDescription: ({ name, filePath }) =>
		`Perspectiefanker: ${name} — ${filePath}. Dit staat los van grafieknavigatie.`,
	settingsMyPersonNoCandidatesDescription:
		"Er zijn nog geen geldige persoonsnotities geïndexeerd. Maak of herstel een canonieke persoonsnotitie en selecteer die hier.",
	settingsMyPersonChooseDescription:
		"Selecteer één unieke canonieke persoonsnotitie als perspectiefanker. Dit staat los van grafieknavigatie.",
	settingsMyPersonUnavailableWarning: ({ id }) => `Persoons-ID “${id}” is niet beschikbaar in de canonieke index.`,
	settingsMyPersonAmbiguousWarning: ({ id, count }) => `Persoons-ID “${id}” is ambigu in ${count} persoonsnotities.`,
	settingsWarningPrefix: "Waarschuwing",
	settingsRelationshipTemplatesHeading: "Relatiesjablonen",
	settingsRelationshipTemplatesEmpty: ({ readOnly }) =>
		`Er zijn nog geen relatiesjablonen. Relatietypen en rollen kunnen nog steeds handmatig worden ingevoerd. Sjablonen kopiëren herbruikbare typen en beide rollen; ze zijn geen livekoppelingen.${
			readOnly
				? " Instellingen voor relatiesjablonen zijn alleen-lezen totdat de People Atlas-plugingegevens zijn hersteld."
				: ""
		}`,
	settingsRelationshipTemplateDescription: ({ id, types, fromRole, toRole }) =>
		`${id} · typen: ${types} · rol eerste persoon: ${fromRole} · rol tweede persoon: ${toRole}`,
	settingsEdit: "Bewerken",
	settingsEditTemplateTooltip: ({ name }) => `Relatiesjabloon ${name} bewerken`,
	settingsTemplateReadOnly:
		"Instellingen voor relatiesjablonen zijn alleen-lezen totdat de People Atlas-plugingegevens zijn hersteld.",
	settingsUpdateLinkedRelationships: "Gekoppelde relaties uit sjabloon bijwerken",
	settingsUpdateTemplateReadOnly:
		"Bijwerken van relatiesjablonen is alleen-lezen totdat de plugingegevens zijn hersteld.",
	settingsReviewTemplateChanges: ({ count }) =>
		`Bekijk ${count} relatienotitie${count === 1 ? "" : "s"} met deze sjabloonherkomst`,
	settingsTemplateAlreadyMatches:
		"Alle geïndexeerde relatienotities met deze sjabloonherkomst komen al overeen met de gekopieerde waarden.",
	settingsAddRelationshipTemplate: "Relatiesjabloon toevoegen",
	settingsShowLabelsName: "Labels tonen",
	settingsShowLabelsDescription: "Teken standaard persoonsnamen onder knooppunten.",
	noticeSettingsReadOnly: "People Atlas-instellingen zijn alleen-lezen totdat de plugingegevens zijn hersteld.",
	noticeSettingsSaveFailed: ({ error }) => `People Atlas-instellingen konden niet worden opgeslagen: ${error}`,
	noticeTemplateUnavailable: ({ presetId }) => `Relatiesjabloon “${presetId}” is niet meer beschikbaar.`,
	noticeTemplateAlreadyMatches:
		"Alle geïndexeerde relatienotities met deze sjabloonherkomst komen al overeen met de gekopieerde waarden.",
	noticeFollowUpMarkedDone: "Opvolging gemarkeerd als afgerond.",
	noticeFollowUpDismissed: "Opvolging genegeerd.",
	relationshipModal: {
		titleCreate: "Relatie aanmaken",
		titleEdit: "Relatie bewerken",
		groupPeople: "Personen",
		firstPerson: "Eerste persoon",
		firstPersonSelected: ({ name }) => `Eerste persoon — ${name}`,
		firstPersonDescription: "Kies één canonieke geïndexeerde persoon als de eerste geselecteerde persoon.",
		secondPerson: "Tweede persoon",
		secondPersonSelected: ({ name }) => `Tweede persoon — ${name}`,
		secondPersonDescription: "Kies één canonieke geïndexeerde persoon als de tweede geselecteerde persoon.",
		groupRelationship: "Relatie",
		simpleRelationship: "Eenvoudige relatie",
		simpleRelationshipDescription:
			"Optionele snelkoppeling van de eerste naar de tweede persoon. Deze vult alleen beide niet-opgeslagen rollen in; Aangepast laat de onderstaande rollen ongewijzigd.",
		simpleCustom: "Aangepast — gebruik hieronder een sjabloon of rollen",
		simpleParent: "Ouder van de tweede persoon",
		simpleChild: "Kind van de tweede persoon",
		simpleSibling: "Broer of zus van de tweede persoon",
		simplePartner: "Partner van de tweede persoon",
		relationshipTemplate: "Relatiesjabloon",
		relationshipTemplateDescription:
			"Sjablonen kopiëren herbruikbare relatietypen en rollen voor beide geselecteerde personen naar dit formulier; het zijn geen live koppelingen.",
		noRelationshipTemplates: "Nog geen relatiesjablonen",
		noRelationshipTemplatesDescription:
			"Handmatige relatiewaarden blijven beschikbaar. Sjablonen kopiëren herbruikbare typen en beide rollen naar het formulier; opgeslagen relatienotities bewaren die gekopieerde waarden.",
		createTemplate: "Sjabloon maken",
		applyLatestTemplateValues: "Nieuwste sjabloonwaarden toepassen",
		relationshipTypes: "Relatietypen",
		relationshipTypesDescription:
			"Optionele kommagescheiden labels. Een sjabloon kan deze waarden naar het niet-opgeslagen formulier kopiëren.",
		firstPersonRole: "Rol van de eerste persoon",
		myRole: "Mijn rol",
		personRole: ({ name }) => `Rol van ${name}`,
		firstPersonRoleDescription:
			"Rol van de eerste geselecteerde persoon. Definieer rollen voor beide geselecteerde personen of laat beide leeg.",
		secondPersonRole: "Rol van de tweede persoon",
		secondPersonRoleDescription:
			"Rol van de tweede geselecteerde persoon. Die blijft bij die persoon wanneer je opslaat.",
		groupContext: "Context",
		closeness: "Nabijheid",
		closenessDescription: "Optionele waarde van 1 tot en met 5.",
		since: "Sinds",
		sinceDescription: "Optionele begindatum van de relatie.",
		lastContact: "Laatste contact",
		lastContactDescription: "Optionele observatiedatum; deze verandert de status nooit automatisch.",
		status: "Status",
		statusDescription: "Optionele relatie-status van de gebruiker. Laatste contact wijzigt die nooit automatisch.",
		statusNotSet: "Niet ingesteld",
		statusActive: "Actief",
		statusDormant: "Inactief",
		statusEnded: "Beëindigd",
		relationshipNotePath: "Pad van relatienotitie",
		sourceNotePath: "Pad van bronnnotitie",
		relationshipNotePathDescription:
			"Controleer of bewerk het voorgestelde Markdown-pad. Bestaande notities worden nooit overschreven.",
		sourceNotePathDescription:
			"Het huidige bronpad is alleen-lezen. Deze relatie verplaatsen of hernoemen valt buiten de editor.",
		relationshipId: "Relatie-ID",
		relationshipIdDescription:
			"Een stabiele relationship_id wordt gegenereerd wanneer een nieuwe relatie wordt opgeslagen.",
		cancel: "Annuleren",
		save: "Opslaan",
		noTemplate: "Geen sjabloon — voer waarden handmatig in",
		missingTemplate: ({ presetId }) => `Ontbrekende sjabloon — ${presetId}`,
		templateCreationAvailable:
			"Maak een herbruikbare sjabloon zonder deze niet-opgeslagen relatie te verliezen. Die wordt niet automatisch geselecteerd.",
		templateCreationUnavailable:
			"Een sjabloon maken is niet beschikbaar omdat People Atlas-instellingen alleen-lezen of ongeldig zijn. Handmatige relatiewaarden blijven beschikbaar.",
		presetUnlinked:
			"Er is geen sjabloon geselecteerd. Typen en rollen worden bij opslaan rechtstreeks op deze relatienotitie bewaard.",
		presetUpToDate: "De niet-opgeslagen typen en rollen komen overeen met de waarden uit de geselecteerde sjabloon.",
		presetModified:
			"De niet-opgeslagen typen of rollen verschillen van de geselecteerde sjabloon. Pas de nieuwste waarden alleen toe als je ze wilt vervangen.",
		presetMissing: ({ presetId }) =>
			`Sjabloon “${presetId}” is niet beschikbaar. De gekopieerde typen en rollen blijven bewerkbaar.`,
		rolePreviewPlaceholder:
			"Kies beide personen en definieer beide rollen om te bekijken hoe elke geselecteerde persoon aan een rol is gekoppeld.",
		rolePreview: ({ fromName, fromRole, toName, toRole }) =>
			`In deze relatie is de rol van ${fromName} ${fromRole} en de rol van ${toName} ${toRole}.`,
		familyTerms: {
			mother: "moeder",
			father: "vader",
			daughter: "dochter",
			son: "zoon",
			sister: "zus",
			brother: "broer",
		},
		advancedDestination: ({ path }) => `Geavanceerd — Bestemming: ${path}`,
		advancedSource: ({ path }) => `Geavanceerd — Bron: ${path}`,
		notSet: "niet ingesteld",
	},
	relationshipPresetModal: {
		titleCreate: "Relatiesjabloon maken",
		titleEdit: "Relatiesjabloon bewerken",
		description:
			"Sjablonen kopiëren relatietypen, de rol van de eerste persoon en de rol van de tweede persoon naar een relatieformulier; het zijn geen live koppelingen. Nieuwe relaties zetten Mijn persoon normaal als eerste wanneer die wordt opgelost, maar sjablonen werken ook voor relaties tussen willekeurige twee personen. Rollen horen altijd bij de eerste en tweede geselecteerde persoon.",
		templateId: "Sjabloon-ID",
		name: "Naam",
		relationshipTypes: "Relatietypen",
		firstPersonRole: "Rol eerste persoon",
		secondPersonRole: "Rol tweede persoon",
		cancel: "Annuleren",
		save: "Opslaan",
	},
	relationshipPresetSyncModal: {
		title: "Gekoppelde relaties vanuit sjabloon bijwerken",
		cancel: "Annuleren",
		confirm: "Gekoppelde relaties vanuit sjabloon bijwerken",
		close: "Sluiten",
		intro: ({ count, presetName }) =>
			`Beoordeel ${count} relatienotitie${count === 1 ? "" : "s"} waarvan de opgeslagen sjabloonherkomst “${presetName}” is. Bevestigen kopieert de relatietypen, rol van de eerste persoon en rol van de tweede persoon uit dit sjabloon naar precies de onderstaande paden. Eindpunten, paden, relatie-ID's, nabijheid, datums, status, niet-gerelateerde frontmatter en notitie-inhoud blijven ongewijzigd.`,
		preview: ({ types, fromRole, toRole }) =>
			`typen: ${types}; rol eerste persoon: ${fromRole}; rol tweede persoon: ${toRole}`,
		none: "geen",
		success: ({ completed, skipped }) =>
			`Bijgewerkt: ${completed}; overgeslagen: ${skipped}; niets resteert uit deze voorvertoning.`,
	},
	relationshipPresetDelete: {
		title: ({ presetName }) => `Relatiesjabloon “${presetName}” verwijderen?`,
		content: ({ linked }) =>
			`Dit sjabloon is gekoppeld aan ${linked} relatienotitie${linked === 1 ? "" : "s"}. Die notities behouden hun gekopieerde typen en rollen. Hun sjabloonherkomst verwijst niet langer naar een bestaand sjabloon.`,
		cancel: "Annuleren",
		confirm: "Relatiesjabloon verwijderen",
	},
	partnerParentConfirmation: {
		title: "Partner als ouder beoordelen",
		question: ({ parent, partner, child }) =>
			`${parent} heeft partner ${partner}. Is ${partner} ook ouder van ${child}?`,
		notNow: "Nu niet",
		reviewRelationship: "Relatie beoordelen",
	},
	personMentionSuggest: {
		navigate: "navigeren",
		select: "selecteren",
		dismiss: "sluiten",
		create: ({ name, directory }) => `Persoon “${name}” aanmaken in ${directory}/`,
	},
	contactMomentModal: {
		titleCreate: "Contactmoment vastleggen",
		titleEdit: "Contactmoment bewerken",
		groupPeople: "Personen",
		people: "Personen",
		peopleDescription:
			"Kies één of meer canonieke personen. Paden en stabiele ID's — niet weergavenamen — worden als identiteit opgeslagen.",
		relationship: "Relatie",
		relationshipDescription:
			"Optioneel. Alleen canonieke relatienotities die ten minste één geselecteerde persoon delen kunnen het laatste contact bijwerken.",
		groupMoment: "Contactmoment",
		occurredOn: "Datum contactmoment",
		occurredOnDescription: "Verplichte lokale kalenderdatum in de vorm JJJJ-MM-DD.",
		channel: "Kanaal",
		channelDescription: "Optioneel door de gebruiker ingevoerd kanaal. Suggesties leiden nooit een waarde af.",
		summary: "Samenvatting",
		summaryDescription: "Optionele korte samenvatting. De Markdowntekst blijft vrije inhoud.",
		groupFollowUp: "Opvolging",
		followUpOn: "Opvolgen op",
		followUpOnDescription: "Optionele lokale kalenderdatum.",
		followUpStatus: "Status opvolging",
		followUpStatusDescription:
			"Open, afgerond en afgewezen gelden alleen voor deze opvolging en veranderen de relatiestatus nooit.",
		statusNotSet: "Niet ingesteld",
		statusOpen: "Open",
		statusDone: "Afgerond",
		statusDismissed: "Afgewezen",
		advanceRelationshipLastContact: "Laatste contact van gekoppelde relatie naar deze datum bijwerken",
		advanced: "Geavanceerd",
		contactMomentNotePath: "Pad contactmomentnotitie",
		sourceNotePath: "Pad bronnotitie",
		contactMomentNotePathDescription:
			"Bekijk of bewerk het voorgestelde Markdownpad. Bestaande notities worden nooit overschreven.",
		sourceNotePathDescription: "Het huidige bronpad is alleen-lezen; verplaatsen of hernoemen valt buiten deze editor.",
		contactMomentId: "ID contactmoment",
		contactMomentIdDescription:
			"Stabiele expliciete identiteit die wordt toegewezen voordat de notitie wordt geschreven.",
		cancel: "Annuleren",
		retryRelationshipUpdate: "Bijwerken van relatie opnieuw proberen",
		save: "Opslaan",
		noLinkedRelationship: "Geen gekoppelde relatie",
		unknownPerson: "Onbekend",
	},
	atlasRenderer: {
		view: "Weergave",
		graph: "Grafiek",
		list: "Lijst",
		followUps: "Opvolgingen",
		interactiveAtlas: "Interactieve personen- en relatieatlas",
		graphControls: "Grafiekbediening",
		zoomOut: "Uitzoomen",
		zoomIn: "Inzoomen",
		fit: "Passend maken",
		details: "Details",
		listView: "Lijstweergave van Personenatlas",
		noPeople: "Geen personen in de huidige atlas",
		peopleInAtlas: "Personen in de huidige atlas",
		selectedPersonDetails: "Details van geselecteerde persoon",
		contactFollowUps: "Contactopvolgingen",
		selection: "Selectie",
		selectPersonHint: "Selecteer een persoon om zichtbare relaties en acties te bekijken.",
		ambiguousPerson: "Ambigue persoon",
		unresolvedPerson: "Onopgeloste persoon",
		ambiguousPersonListLabel: "ambigue persoon",
		unresolvedPersonListLabel: "onopgeloste persoon",
		semanticListSummary: ({ people, connections, hiddenContactMoments }) =>
			`${people} personen · ${connections} verbindingen${
				hiddenContactMoments > 0
					? ` · ${hiddenContactMoments} verborgen contact${hiddenContactMoments === 1 ? "moment" : "momenten"}`
					: ""
			}`,
		relationships: "Relaties",
		relationship: "relatie",
		linkedPeople: "Gekoppelde personen",
		openNote: "Notitie openen",
		useAsCenter: "Als middelpunt gebruiken",
		editPerson: "Persoon bewerken",
		createRelationship: "Relatie aanmaken",
		logContact: "Contact vastleggen",
		close: "Sluiten",
		ambiguousNoOpenCenter: "Dit persoonsrecord is ambigu en kan niet worden geopend of gecentreerd.",
		unresolvedNoNote: "Er is geen notitie beschikbaar voor deze onopgeloste persoon.",
		noNote: "Er is geen notitie beschikbaar voor deze persoon.",
		noVisibleConnections: "Geen zichtbare relaties of gekoppelde personen",
		relationshipListFor: ({ group, name }) => `${group} voor ${name}`,
		openRelationshipNote: "Relatienotitie openen",
		editRelationship: "Relatie bewerken",
		ambiguousNoActions: "Dit persoonsrecord is ambigu. Er zijn geen acties beschikbaar.",
		unresolvedNoActions: "Deze onopgeloste persoon heeft geen beschikbare acties.",
		noNoteNoActions: "Deze persoon heeft geen notitie of beschikbare acties.",
		contactMoments: "Contactmomenten",
		nextFollowUp: "Volgende opvolging",
		allContactMoments: "Alle contactmomenten",
		recentContactMoments: "Recente contactmomenten",
		noContactMoments: "Geen contactmomenten",
		contactMomentListFor: ({ scope, name }) => `${scope} contactmomenten voor ${name}`,
		showRecentContactMoments: "Recente contactmomenten tonen",
		viewAllContactMoments: "Alle contactmomenten bekijken",
		noOpenFollowUps: "Geen open opvolgingen",
		followUpsSummary: ({ openCount, hiddenCount }) =>
			`${openCount} openstaande opvolging${openCount === 1 ? "" : "en"}${
				hiddenCount > 0 ? ` · ${hiddenCount} contactmoment${hiddenCount === 1 ? "" : "en"} verborgen` : ""
			}`,
		overdue: "Te laat",
		dueToday: "Vandaag gepland",
		upcoming: "Aanstaand",
		followUpPrefix: "Opvolging ",
		contactPrefix: "Contact ",
		channel: ({ channel }) => `Kanaal: ${channel}`,
		openContactMoment: "Contactmoment openen",
		editContactMoment: "Contactmoment bewerken",
		markFollowUpDone: "Opvolging afronden",
		dismissFollowUp: "Opvolging afwijzen",
		due: ({ date }) => `gepland ${date}`,
		unknownDate: "onbekende datum",
		contactActionName: ({ action, people, date }) => `${action} voor ${people}, ${date}`,
		actionWithContext: ({ action, context }) => `${action} ${context}`,
		contactActionContext: ({ person, date, discriminator, placement }) =>
			`voor ${person}, ${date}${discriminator}${placement}`,
		contactEntry: ({ index, count }) => `, contact ${index} van ${count}`,
		followUpDue: ({ date }) => `, opvolging gepland ${date}`,
		contactOrdinal: ({ index, count }) => `contact ${index} van ${count}`,
		unavailablePerson: "Niet-beschikbare persoon",
		relationshipSummary: ({ source, target, kind }) => `Relatie: ${source} en ${target} · ${kind}`,
	},
	personProfile: {
		pronouns: "Voornaamwoorden",
		jobTitle: "Functietitel",
		organisations: "Organisaties",
		birthDate: "Geboortedatum",
		gender: "Gender",
		email: "E-mail",
		phone: "Telefoon",
		contactDetails: "Contactgegevens",
		photoMissing: "Foto niet beschikbaar: de verwezen vaultafbeelding kon niet worden gevonden.",
		photoUnsupported: "Foto niet beschikbaar: dit bestandstype wordt niet ondersteund.",
		photoDecodeError: "Foto niet beschikbaar: de afbeelding kon niet worden gedecodeerd.",
		photoUnavailable: "Foto niet beschikbaar: er kon geen veilige vaultresource worden voorbereid.",
	},
	relationshipRows: {
		unresolvedSuffix: " (onopgelost)",
		ambiguousSuffix: " (ambigu)",
		linkedPerson: ({ name }) => `Gekoppelde persoon: ${name}.`,
		connectedTo: ({ name }) => `Verbonden met ${name}`,
		familyTerms: {
			mother: "moeder",
			father: "vader",
			daughter: "dochter",
			son: "zoon",
			sister: "zus",
			brother: "broer",
		},
		types: ({ types }) => `Typen: ${types}`,
		status: ({ status }) => `Status: ${status}`,
		since: ({ since }) => `Sinds: ${since}`,
		lastContact: ({ lastContact }) => `Laatste contact: ${lastContact}`,
		actionAccessibleName: ({ action, context }) => `${action} met ${context}`,
	},
	peopleAtlasView: {
		center: "Middelpunt",
		configuredCenter: "Ingesteld middelpunt",
		activeNote: "Actieve notitie",
		selectedNode: "Geselecteerd knooppunt",
		noCenter: "Geen middelpunt",
		projection: "Projectie",
		egoNetwork: "Egonetwerk",
		freeNetwork: "Vrij netwerk",
		contactHealth: "Contactgezondheid",
		allPeople: "Alle personen",
		selectNodeHint:
			"Selecteer een knooppunt. Dubbelklik om het te centreren; Shift-dubbelklik om de notitie te openen.",
		personNoteUnavailable: "Persoonsnotitie niet beschikbaar",
		open: "Openen",
		stats: ({ people, connections }) => `${people} personen · ${connections} verbindingen`,
	},
	basesView: {
		edit: ({ name }) => `${name} bewerken`,
		createRelationshipWith: ({ name }) => `Relatie met ${name} aanmaken`,
		logContactWith: ({ name }) => `Contact met ${name} vastleggen`,
	},
	readingView: {
		actions: "People Atlas-acties",
		addRelationship: "Relatie toevoegen",
	},
	personModal: {
		titleCreate: "Persoon aanmaken",
		titleEdit: "Huidige persoon bewerken",
		sectionBasic: "Basis",
		sectionProfile: "Profiel",
		sectionContactDetails: "Contactgegevens",
		sectionLinkedPeople: "Gekoppelde personen",
		advanced: "Geavanceerd",
		name: "Naam",
		nameDescriptionCreate: "Verplichte weergavenaam. De bestandsnaam van de nieuwe notitie wordt hiervan afgeleid.",
		nameDescriptionEdit: "Het wijzigen van de weergavenaam stelt ook een bestandsnaamwijziging in de huidige map voor.",
		createPhotoHint:
			"Foto: sla deze persoon eerst op om de dossiermap te maken. Plaats zelf een afbeelding in het persoonsdossier. Open daarna Bewerken en kies de dossierafbeelding.",
		aliases: "Aliassen",
		aliasesDescription: "Optionele alternatieve namen, één per regel.",
		pronouns: "Voornaamwoorden",
		pronounsDescription:
			"Optionele voornaamwoorden van de gebruiker. People Atlas leidt daaruit geen relatiebetekenis af.",
		gender: "Gender",
		genderDescription: "Optionele genderwaarde van de gebruiker. People Atlas leidt daaruit geen relatiebetekenis af.",
		jobTitle: "Functietitel",
		jobTitleDescription: "Optionele huidige functietitel.",
		organisations: "Organisaties",
		organisationsDescription: "Optionele organisaties, één per regel.",
		emailAddresses: "E-mailadressen",
		emailAddressesDescription:
			"Voeg per invoer één adres toe. Elk adres heeft één @; duplicaten worden zonder hoofdlettergevoeligheid vergeleken.",
		phoneNumbers: "Telefoonnummers",
		phoneNumbersDescription: "Voeg per invoer één nummer toe. Opmaak en internationale voorvoegsels blijven behouden.",
		personNotePath: "Pad van persoonsnotitie",
		currentPersonNotePath: "Pad van huidige persoonsnotitie",
		personNotePathDescriptionCreate: "De ingestelde Personenmap en een veilige bestandsnaam bepalen dit pad.",
		personNotePathDescriptionEdit:
			"De notitie blijft in deze map. Een gewijzigde bestandsnaam vereist een afzonderlijke bevestiging.",
		personId: "Person-ID",
		personIdDescription:
			"Stabiele identiteit die vóór elke vaultwrite wordt gepland en door People Atlas wordt beheerd.",
		cancel: "Annuleren",
		save: "Opslaan",
		photo: "Foto",
		photoDescription:
			"Opgeslagen vaultpad of wikilink. Gebruik de dossierafbeeldingkiezer of Foto wissen om dit te wijzigen; ongewijzigde ingevoerde tekst blijft exact.",
		searchDossierImages: "Dossierafbeeldingen zoeken",
		searchDossierImagesDescription:
			"Filter ondersteunde PNG-, JPG-, JPEG-, WebP-, GIF- en AVIF-bestanden in het eigen dossier van deze persoon.",
		dossierImage: "Dossierafbeelding",
		dossierImageDescription:
			"Elke keuze uit het eigen dossier van deze persoon gebruikt het volledige vaultrelatieve pad, zodat gelijke bestandsnamen verschillend blijven.",
		clearPhoto: "Foto wissen",
		noSupportedDossierImages: "Geen ondersteunde dossierafbeeldingen",
		noDossierImagesMatch: "Geen dossierafbeeldingen komen overeen",
		chooseDossierImage: "Kies een dossierafbeelding",
		selectedPhotoUnavailable: ({ path }) =>
			`De geselecteerde foto “${path}” is niet langer uniek beschikbaar in de vault. Kies deze opnieuw of wis de foto.`,
		photoEmpty: "Er is geen foto geselecteerd. Initialen worden getoond.",
		photoExternal: "Externe of netwerkfotoreferenties worden niet ondersteund. Initialen worden getoond.",
		photoUnreadable: "De fotoreferentie is niet leesbaar. Initialen worden getoond.",
		photoMissing: "De verwezen vaultafbeelding ontbreekt. Initialen worden getoond.",
		photoUnsupported:
			"Deze foto-indeling wordt niet ondersteund. Kies een PNG-, JPG-, JPEG-, WebP-, GIF- of AVIF-afbeelding.",
		photoUnavailable: "De geselecteerde vaultafbeelding is tijdelijk niet beschikbaar. Initialen worden getoond.",
		photoLoading: "De geselecteerde vaultafbeelding wordt geladen. Initialen worden getoond totdat deze klaar is.",
		photoDecodeError: "De geselecteerde vaultafbeelding kon niet worden gedecodeerd. Initialen worden getoond.",
		birthDate: "Geboortedatum",
		birthDateDescription:
			"Vul maand en dag in. Een jaartal van vier cijfers is optioneel; alleen het jaartal wissen behoudt een verjaardag zonder bekend jaar.",
		month: "Maand",
		monthDescription: "Maandnummer van 1 tot en met 12.",
		day: "Dag",
		dayDescription: "Een kalendergeldige dag voor de gekozen maand.",
		yearOptional: "Jaar (optioneel)",
		yearDescription: "Optioneel jaartal van vier cijfers, van 0001 tot en met 9999.",
		clearBirthDate: "Geboortedatum wissen",
		emailAddress: ({ index }) => `E-mailadres ${index}`,
		phoneNumber: ({ index }) => `Telefoonnummer ${index}`,
		remove: "Verwijderen",
		removeEmailAddress: ({ index }) => `E-mailadres ${index} verwijderen`,
		removePhoneNumber: ({ index }) => `Telefoonnummer ${index} verwijderen`,
		addEmailAddress: "E-mailadres toevoegen",
		addPhoneNumber: "Telefoonnummer toevoegen",
		linkedPeopleDescription:
			"Koppelingen worden als eenvoudige verbindingen op deze persoonsnotitie opgeslagen. Nieuwe koppelingen moeten naar één canonieke persoon gaan die niet dezelfde persoon is. Bestaande onopgeloste waarden blijven staan totdat je ze verwijdert. Gebruik Relatie aanmaken voor rollen, datums, status en andere rijke metadata.",
		unresolvedOrAmbiguous: ({ value }) => `Onopgelost of ambigu — ${value}`,
		removeLinkedPerson: ({ value }) => `Gekoppelde persoon ${value} verwijderen`,
		addLinkedPerson: "Gekoppelde persoon toevoegen",
		addLinkedPersonButton: "Gekoppelde persoon toevoegen",
		confirmRename: "Persoon hernoemen bevestigen",
		renameExplanation:
			"Deze naam opslaan hernoemt ook de Markdown-notitie. Obsidian werkt links bij volgens de vaultinstelling voor automatische linkupdates.",
		currentPath: "Huidig pad",
		newPath: "Nieuw pad",
		back: "Terug",
		renameAndSave: "Hernoemen en opslaan",
		retryRenameAndSave: "Hernoemen en opslaan opnieuw proberen",
		advancedDestination: ({ path }) => `Geavanceerd — Bestemming: ${path}`,
		advancedCurrentPath: ({ path }) => `Geavanceerd — Huidig pad: ${path}`,
	},
};

export const messageCatalogs: Record<SupportedLocale, Catalog> = {
	en: englishCatalog,
	nl: dutchCatalog,
};

export type Translator = Catalog;

export function resolveLocale(language: string | undefined): SupportedLocale {
	const languageCode = language?.trim().toLowerCase().split(/[-_]/)[0];
	return languageCode === "nl" ? "nl" : "en";
}

export function createTranslator(language: string | undefined): Translator {
	return messageCatalogs[resolveLocale(language)];
}
