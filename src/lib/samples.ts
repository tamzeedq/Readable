// Public-domain sample books for the empty library ("Add sample books").
import { useAppStore } from '../store/appStore';
import { saveParsedBook } from './importer';
import { parseSections } from './parser';

interface Sample {
  title: string;
  author: string;
  description: string;
  shelves: string[];
  sections: { title: string; paragraphs: string[] }[];
}

const SAMPLES: Sample[] = [
  {
    title: 'Middlemarch',
    author: 'George Eliot',
    description: 'The opening of George Eliot’s 1871 novel of provincial life: the Prelude and the first pages of Chapter I.',
    shelves: ['fiction'],
    sections: [
      {
        title: 'Prelude',
        paragraphs: [
          'Who that cares much to know the history of man, and how the mysterious mixture behaves under the varying experiments of Time, has not dwelt, at least briefly, on the life of Saint Theresa, has not smiled with some gentleness at the thought of the little girl walking forth one morning hand-in-hand with her still smaller brother, to go and seek martyrdom in the country of the Moors? Out they toddled from rugged Avila, wide-eyed and helpless-looking as two fawns, but with human hearts, already beating to a national idea; until domestic reality met them in the shape of uncles, and turned them back from their great resolve. That child-pilgrimage was a fit beginning. Theresa’s passionate, ideal nature demanded an epic life: what were many-volumed romances of chivalry and the social conquests of a brilliant girl to her? Her flame quickly burned up that light fuel; and, fed from within, soared after some illimitable satisfaction, some object which would never justify weariness, which would reconcile self-despair with the rapturous consciousness of life beyond self. She found her epos in the reform of a religious order.',
          'That Spanish woman who lived three hundred years ago, was certainly not the last of her kind. Many Theresas have been born who found for themselves no epic life wherein there was a constant unfolding of far-resonant action; perhaps only a life of mistakes, the offspring of a certain spiritual grandeur ill-matched with the meanness of opportunity; perhaps a tragic failure which found no sacred poet and sank unwept into oblivion. With dim lights and tangled circumstance they tried to shape their thought and deed in noble agreement; but after all, to common eyes their struggles seemed mere inconsistency and formlessness; for these later-born Theresas were helped by no coherent social faith and order which could perform the function of knowledge for the ardently willing soul. Their ardor alternated between a vague ideal and the common yearning of womanhood; so that the one was disapproved as extravagance, and the other condemned as a lapse.',
          'Some have felt that these blundering lives are due to the inconvenient indefiniteness with which the Supreme Power has fashioned the natures of women: if there were one level of feminine incompetence as strict as the ability to count three and no more, the social lot of women might be treated with scientific certitude. Meanwhile the indefiniteness remains, and the limits of variation are really much wider than any one would imagine from the sameness of women’s coiffure and the favorite love-stories in prose and verse. Here and there a cygnet is reared uneasily among the ducklings in the brown pond, and never finds the living stream in fellowship with its own oary-footed kind. Here and there is born a Saint Theresa, foundress of nothing, whose loving heart-beats and sobs after an unattained goodness tremble off and are dispersed among hindrances, instead of centring in some long-recognizable deed.',
        ],
      },
      {
        title: 'Chapter I',
        paragraphs: [
          'Since I can do no good because a woman, Reach constantly at something that is near it. —The Maid’s Tragedy: Beaumont and Fletcher.',
          'Miss Brooke had that kind of beauty which seems to be thrown into relief by poor dress. Her hand and wrist were so finely formed that she could wear sleeves not less bare of style than those in which the Blessed Virgin appeared to Italian painters; and her profile as well as her stature and bearing seemed to gain the more dignity from her plain garments, which by the side of provincial fashion gave her the impressiveness of a fine quotation from the Bible,—or from one of our elder poets,—in a paragraph of to-day’s newspaper. She was usually spoken of as being remarkably clever, but with the addition that her sister Celia had more common-sense. Nevertheless, Celia wore scarcely more trimmings; and it was only to close observers that her dress differed from her sister’s, and had a shade of coquetry in its arrangements; for Miss Brooke’s plain dressing was due to mixed conditions, in most of which her sister shared. The pride of being ladies had something to do with it: the Brooke connections, though not exactly aristocratic, were unquestionably “good:” if you inquired backward for a generation or two, you would not find any yard-measuring or parcel-tying forefathers—anything lower than an admiral or a clergyman; and there was even an ancestor discernible as a Puritan gentleman who served under Cromwell, but afterwards conformed, and managed to come out of all political troubles as the proprietor of a respectable family estate.',
        ],
      },
    ],
  },
  {
    title: 'Walden',
    author: 'Henry David Thoreau',
    description: 'Passages from “Where I Lived, and What I Lived For,” Thoreau’s account of his two years at Walden Pond (1854).',
    shelves: [],
    sections: [
      {
        title: 'Morning',
        paragraphs: [
          'Every morning was a cheerful invitation to make my life of equal simplicity, and I may say innocence, with Nature herself. I have been as sincere a worshipper of Aurora as the Greeks. I got up early and bathed in the pond; that was a religious exercise, and one of the best things which I did.',
        ],
      },
      {
        title: 'Deliberately',
        paragraphs: [
          'I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived. I did not wish to live what was not life, living is so dear; nor did I wish to practise resignation, unless it was quite necessary. I wanted to live deep and suck out all the marrow of life, to live so sturdily and Spartan-like as to put to rout all that was not life, to cut a broad swath and shave close, to drive life into a corner, and reduce it to its lowest terms, and, if it proved to be mean, why then to get the whole and genuine meanness of it, and publish its meanness to the world; or if it were sublime, to know it by experience, and be able to give a true account of it in my next excursion. For most men, it appears to me, are in a strange uncertainty about it, whether it is of the devil or of God, and have somewhat hastily concluded that it is the chief end of man here to “glorify God and enjoy him forever.”',
          'Still we live meanly, like ants; though the fable tells us that we were long ago changed into men; like pygmies we fight with cranes; it is error upon error, and clout upon clout, and our best virtue has for its occasion a superfluous and evitable wretchedness. Our life is frittered away by detail. An honest man has hardly need to count more than his ten fingers, or in extreme cases he may add his ten toes, and lump the rest. Simplicity, simplicity, simplicity! I say, let your affairs be as two or three, and not a hundred or a thousand; instead of a million count half a dozen, and keep your accounts on your thumb-nail.',
        ],
      },
      {
        title: 'The Stream',
        paragraphs: [
          'Time is but the stream I go a-fishing in. I drink at it; but while I drink I see the sandy bottom and detect how shallow it is. Its thin current slides away, but eternity remains. I would drink deeper; fish in the sky, whose bottom is pebbly with stars. I cannot count one. I know not the first letter of the alphabet. I have always been regretting that I was not as wise as the day I was born.',
        ],
      },
    ],
  },
  {
    title: 'Frankenstein',
    author: 'Mary Shelley',
    description: 'The first of Robert Walton’s letters to his sister, which open Mary Shelley’s 1818 novel.',
    shelves: ['to-read'],
    sections: [
      {
        title: 'Letter 1',
        paragraphs: [
          'To Mrs. Saville, England.',
          'St. Petersburgh, Dec. 11th, 17—.',
          'You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings. I arrived here yesterday, and my first task is to assure my dear sister of my welfare and increasing confidence in the success of my undertaking.',
          'I am already far north of London, and as I walk in the streets of Petersburgh, I feel a cold northern breeze play upon my cheeks, which braces my nerves and fills me with delight. Do you understand this feeling? This breeze, which has travelled from the regions towards which I am advancing, gives me a foretaste of those icy climes. Inspirited by this wind of promise, my daydreams become more fervent and vivid. I try in vain to be persuaded that the pole is the seat of frost and desolation; it ever presents itself to my imagination as the region of beauty and delight. There, Margaret, the sun is for ever visible, its broad disk just skirting the horizon and diffusing a perpetual splendour. There—for with your leave, my sister, I will put some trust in preceding navigators—there snow and frost are banished; and, sailing over a calm sea, we may be wafted to a land surpassing in wonders and in beauty every region hitherto discovered on the habitable globe. Its productions and features may be without example, as the phenomena of the heavenly bodies undoubtedly are in those undiscovered solitudes. What may not be expected in a country of eternal light? I may there discover the wondrous power which attracts the needle and may regulate a thousand celestial observations that require only this voyage to render their seeming eccentricities consistent for ever. I shall satiate my ardent curiosity with the sight of a part of the world never before visited, and may tread a land never before imprinted by the foot of man. These are my enticements, and they are sufficient to conquer all fear of danger or death and to induce me to commence this laborious voyage with the joy a child feels when he embarks in a little boat, with his holiday mates, on an expedition of discovery up his native river. But supposing all these conjectures to be false, you cannot contest the inestimable benefit which I shall confer on all mankind, to the last generation, by discovering a passage near the pole to those countries, to reach which at present so many months are requisite; or by ascertaining the secret of the magnet, which, if at all possible, can only be effected by an undertaking such as mine.',
          'These reflections have dispelled the agitation with which I began my letter, and I feel my heart glow with an enthusiasm which elevates me to heaven, for nothing contributes so much to tranquillise the mind as a steady purpose—a point on which the soul may fix its intellectual eye. This expedition has been the favourite dream of my early years. I have read with ardour the accounts of the various voyages which have been made in the prospect of arriving at the North Pacific Ocean through the seas which surround the pole. You may remember that a history of all the voyages made for purposes of discovery composed the whole of our good Uncle Thomas’ library. My education was neglected, yet I was passionately fond of reading. These volumes were my study day and night, and my familiarity with them increased that regret which I had felt, as a child, on learning that my father’s dying injunction had forbidden my uncle to allow me to embark in a seafaring life.',
        ],
      },
    ],
  },
];

/** Adds the public-domain samples, skipping any already in the library (same title + author). */
export async function addSampleBooks(): Promise<void> {
  const existing = useAppStore.getState().books;
  const shelfIds = new Set(useAppStore.getState().shelves.map((s) => s.id));
  // Add in reverse so the first sample ends up at the top of the (newest-first) library
  for (const s of [...SAMPLES].reverse()) {
    if (existing.some((b) => !b.transient && b.title === s.title && b.author === s.author)) continue;
    const parsed = parseSections({ title: s.title, author: s.author, description: s.description }, s.sections);
    const text = s.sections.map((sec) => [sec.title, ...sec.paragraphs].join('\n\n')).join('\n\n');
    await saveParsedBook(parsed, {
      format: 'txt',
      sizeBytes: new Blob([text]).size,
      shelves: s.shelves.filter((id) => shelfIds.has(id)),
      tags: ['sample'],
    });
  }
}
