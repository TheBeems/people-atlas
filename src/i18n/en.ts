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

type NoticeErrorParameters = {
	error: string;
};

type DiagnosticMessageParameters = {
	code: string;
	message: string;
};

type NoteKind = "person" | "relationship" | "contact-moment";

type NoteOpenFailureParameters = NoticeErrorParameters & {
	kind: NoteKind;
};

export const englishCatalog = {
	commandOpenAtlas: "Open atlas",
	commandOpenFollowUps: "Open follow-ups",
	commandCreatePerson: "Create person",
	commandEditCurrentPerson: "Edit current person",
	commandCreateRelationship: "Create relationship",
	commandEditCurrentRelationship: "Edit current relationship",
	commandLogContact: "Log contact",
	commandEditCurrentContactMoment: "Edit current contact moment",
	commandRebuildIndex: "Rebuild People Atlas index",
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
	noticeSettingsLoadFailed: ({ error }: NoticeErrorParameters) => `People Atlas settings could not be loaded: ${error}`,
	noticeInvalidRelationshipTemplates: ({ error }: NoticeErrorParameters) =>
		`Relationship templates are invalid: ${error}`,
	noticeInvalidRelationshipRoleFormat: ({ error }: NoticeErrorParameters) =>
		`Relationship role format is invalid: ${error}`,
	noticeInvalidPeopleRootFolder: ({ error }: NoticeErrorParameters) => `People root folder is invalid: ${error}`,
	noticeInvalidPersonProperties: ({ error }: NoticeErrorParameters) => `Person property mappings are invalid: ${error}`,
	noticeInvalidContactMomentProperties: ({ error }: NoticeErrorParameters) =>
		`Contact-moment property mappings are invalid: ${error}`,
	noticeInvalidNoteTypeValues: ({ error }: NoticeErrorParameters) => `Note type values are invalid: ${error}`,
	noticeFollowUpChangeFailed: ({ error }: NoticeErrorParameters) => `The follow-up was not changed: ${error}`,
	noticeContactMomentEditUnavailable: ({ error }: NoticeErrorParameters) =>
		`The contact moment cannot be edited until its person references are repaired: ${error}`,
	noticeTemplateSyncStopped: ({
		filePath,
		completed,
		skipped,
		remaining,
		error,
	}: {
		filePath?: string;
		completed: number;
		skipped: number;
		remaining: number;
		error: string;
	}) =>
		`Stopped${filePath ? ` at “${filePath}”` : ""}. Completed ${completed}; skipped ${skipped}; remaining ${remaining}. ${error}`,
	noticeTemplateUnavailable: ({ presetId }: TemplateUnavailableParameters) =>
		`Relationship template “${presetId}” is no longer available.`,
	noticeTemplateAlreadyMatches:
		"All indexed relationship notes with this template provenance already match its copied values.",
	noticePersonUnavailable: "The selected person is no longer available in the People Atlas index.",
	noticeMyPersonSelectionRejected: ({ filePath }: { filePath: string }) =>
		`My person selection “${filePath}” is not one unique canonical person note and was not saved. Choose one unique person note or clear the field.`,
	noticeMentionActionFailed: ({ error }: NoticeErrorParameters) => error,
	noticeRelationshipRoleFormatMustBeText: "The relationship role format must be text.",
	noticeViewStateReadOnly: "People Atlas view state is read-only until the plugin data is repaired.",
	noticeViewStateSaveFailed: ({ error }: NoticeErrorParameters) =>
		`People Atlas view state could not be saved: ${error}`,
	noticeNoEditablePersonActive: "No editable person note is active.",
	noticePersonSourceChanged:
		"The selected person changed while its source was being verified. Reopen it before editing.",
	noticeNoEditableRelationshipActive: "No editable relationship note is active.",
	noticeNoEditableContactMomentActive: "No editable contact-moment note is active.",
	noticeOpenNoteFailed: ({ kind, error }: NoteOpenFailureParameters) =>
		`The ${kind} note could not be opened: ${error}`,
	noticeCreatedNoteOpenFailed: ({ kind, error }: NoteOpenFailureParameters) =>
		`The ${kind} was created but could not be opened: ${error}`,
	noticeContactMomentActionUnavailable:
		"The selected contact moment changed or is no longer available. Review the current atlas data.",
	noticeFollowUpUnavailable:
		"The selected follow-up changed or is no longer available. Review the current contact moment.",
	noticePersonWritesReadOnly:
		"Person creation and editing are read-only until the People Atlas plugin data is repaired.",
	noticeRelationshipUnavailable: "The selected relationship is no longer available in the People Atlas index.",
	noticeRelationshipWritesReadOnly:
		"Relationship creation and editing are read-only until the People Atlas plugin data is repaired.",
	noticeContactMomentUnavailable: "The selected contact moment is no longer available in the People Atlas index.",
	noticeContactMomentWritesReadOnly:
		"Contact-moment creation and editing are read-only until the People Atlas plugin data is repaired.",
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
		error: ({ error }: NoticeErrorParameters) => error,
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
		saveRejected:
			"The relationship template could not be saved. People Atlas settings may have become read-only or invalid; review the settings and try again.",
		saveFailed: ({ error }: NoticeErrorParameters) => `The relationship template could not be saved: ${error}`,
		validationError: ({ error }: NoticeErrorParameters) => error,
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
		updateFailed: ({ error }: NoticeErrorParameters) => `Update failed before completion: ${error}`,
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
		error: ({ error }: NoticeErrorParameters) => error,
		partialSuccess: ({
			momentPath,
			relationshipPath,
			reason,
		}: {
			momentPath: string;
			relationshipPath: string;
			reason: string;
		}) => `Contact moment saved at “${momentPath}”, but relationship “${relationshipPath}” was not updated: ${reason}`,
		relationshipNotice: ({ message }: { message: string }) => message,
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
			peopleCount,
			connections,
			connectionsCount,
			hiddenContactMoments,
			hiddenContactMomentCount,
		}: {
			people: string;
			peopleCount: number;
			connections: string;
			connectionsCount: number;
			hiddenContactMoments: string;
			hiddenContactMomentCount: number;
		}) =>
			`${people} ${peopleCount === 1 ? "person" : "people"} · ${connections} ${
				connectionsCount === 1 ? "connection" : "connections"
			}${
				hiddenContactMomentCount > 0
					? ` · ${hiddenContactMoments} contact ${hiddenContactMomentCount === 1 ? "moment" : "moments"} hidden`
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
		diagnosticsHeading: ({ count }: { count: number }) => `Diagnostics (${count})`,
		diagnosticMessage: ({ message }: DiagnosticMessageParameters) => message,
		openDiagnosticSource: "Open source note",
		nextFollowUp: "Next follow-up",
		allContactMoments: "All contact moments",
		recentContactMoments: "Recent contact moments",
		noContactMoments: "No contact moments",
		contactMomentListFor: ({ scope, name }: { scope: string; name: string }) => `${scope} contact moments for ${name}`,
		showRecentContactMoments: "Show recent contact moments",
		viewAllContactMoments: "View all contact moments",
		noOpenFollowUps: "No open follow-ups",
		followUpsSummary: ({
			openCount,
			openCountValue,
			hiddenCount,
			hiddenCountValue,
		}: {
			openCount: string;
			openCountValue: number;
			hiddenCount: string;
			hiddenCountValue: number;
		}) =>
			`${openCount} open follow-up${openCountValue === 1 ? "" : "s"}${
				hiddenCountValue > 0 ? ` · ${hiddenCount} contact moment${hiddenCountValue === 1 ? "" : "s"} hidden` : ""
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
		birthDateYearUnknown: ({ date }: { date: string }) => `${date} (year unknown)`,
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
		stats: ({
			people,
			peopleCount,
			connections,
			connectionsCount,
		}: {
			people: string;
			peopleCount: number;
			connections: string;
			connectionsCount: number;
		}) =>
			`${people} ${peopleCount === 1 ? "person" : "people"} · ${connections} ${connectionsCount === 1 ? "connection" : "connections"}`,
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
		error: ({ error }: NoticeErrorParameters) => error,
	},
};

type LocalizedCatalogValue<Value> = Value extends (...args: infer Parameters) => string
	? (...args: Parameters) => string
	: Value extends object
		? { [Key in keyof Value]: LocalizedCatalogValue<Value[Key]> }
		: string;

export type Translator = LocalizedCatalogValue<typeof englishCatalog>;
